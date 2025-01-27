/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Network } from "./constructs/network";
import { devConfig } from "../config";
import { Database } from "./constructs/database";
import { ChatApp } from "./constructs/app";
import { LambdaWebAdapter } from "./constructs/lambda-web-adapter";
import { Api } from "./constructs/api";
import { VectorDB } from "./constructs/vector";
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { FSxN } from "./constructs/fsx";
import { Ad } from "./constructs/ad";
import { EmbeddingServer } from "./constructs/embedding-server";
import { NagSuppressions } from "cdk-nag";
import { Version } from "aws-cdk-lib/aws-lambda";
import { Auth } from "./constructs/auth";

interface FSxNRagStackProps extends cdk.StackProps {
  wafAttrArn: string;
  edgeFnVersion: Version;
}

export class FSxNRagStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FSxNRagStackProps) {
    super(scope, id, props);

    const network = new Network(this, `${id}-Network`, {
      ...devConfig.networkConfig,
    });

    const ad = new Ad(this, `${id}-Ad`, {
      vpc: network.vpc,
      ...devConfig.adConfig,
    });

    const fsx = new FSxN(this, `${id}-FSx`, {
      vpc: network.vpc,
      ad: ad.microsoftAd,
      adPassword: ad.adPasswoed,
      ...devConfig.adConfig,
    });

    const db = new Database(this, `${id}-Database`, {
      ...devConfig.databaseConfig,
    });

    // const api = new Api(this, "Api", {
    //   ...devConfig.chatAppConfig,
    //   db: db.dynamo,
    //   collectionName: devConfig.vectorConfig.collectionName,
    // });

    const embeddingServerRole = new Role(this, `${id}-EmbeddingServerRole`, {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });

    const auth = new Auth(this, `${id}-Auth`, {
      userName: devConfig.userName,
      adminEmail: devConfig.adminEmail,
    });

    const web = new LambdaWebAdapter(this, `${id}-NextJs`, {
      ...devConfig.chatAppConfig,
      wafAttrArn: props.wafAttrArn,
      edgeFnVersion: props.edgeFnVersion,
      db: db.dynamo,
      cognito: auth.cognitoParams,
      vpc: network.vpc,
    });

    const vector = new VectorDB(this, `${id}-VectorSearch`, {
      roles: [
        // api.lambda.role!.roleArn,
        embeddingServerRole.roleArn,
        web.lambda.role!.roleArn,
      ],
      ...devConfig.vectorConfig,
      vpc: network.vpc,
    });

    if (vector.db instanceof cdk.aws_rds.DatabaseCluster) {
      web.lambda.addEnvironment("SECRETS_ARN", vector.db.secret!.secretArn);
      vector.db.grantDataApiAccess(web.lambda);
      vector.db.connections.allowFrom(
        web.lambda,
        cdk.aws_ec2.Port.tcp(vector.db.clusterEndpoint.port)
      );
    } else {
      web.lambda.addEnvironment(
        "VECTOR_HOST",
        vector.db.attrCollectionEndpoint
      );
      web.lambda.addEnvironment("COLLECTION_NAME", vector.db.name);
      web.lambda.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["aoss:APIAccessAll"],
          resources: [vector.db.attrArn],
        })
      );
      // api.lambda.addEnvironment("AOSS_HOST", vector.aoss.attrCollectionEndpoint);
      // api.lambda.addToRolePolicy(
      //   new PolicyStatement({
      //     effect: Effect.ALLOW,
      //     actions: ["aoss:APIAccessAll"],
      //     resources: [vector.aoss.attrArn],
      //   })
      // );
    }

    web.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminRespondToAuthChallenge",
          "cognito-idp:AdminResetUserPassword",
          "cognito-idp:AdminUserGlobalSignOut",
        ],
        resources: [auth.userPool.userPoolArn],
      })
    );

    const embeddingServer = new EmbeddingServer(this, `${id}-EmbeddingSever`, {
      vpc: network.vpc,
      vector: vector.db,
      adSecret: ad.adPasswoed,
      role: embeddingServerRole,
      imagePath: devConfig.chatAppConfig.imagePath,
      tag: devConfig.chatAppConfig.tag,
      fsx: fsx,
    });
    embeddingServer.instance.node.addDependency(vector.db);

    // new ChatApp(this, "ChatApp", {
    //   ...devConfig.chatAppConfig,
    //   allowedIps: devConfig.allowedIps,
    //   vpc: network.vpc,
    //   api: api.restApi,
    //   hostZone: network.hostZone,
    //   domainName: devConfig.networkConfig.appDomainName,
    //   certificate: network.certificate,
    // });

    NagSuppressions.addResourceSuppressions(
      embeddingServerRole,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Given the least privilege to this role",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Given the least privilege to this role",
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `${cdk.Stack.of(this)}/AWS679f53fac002430cb0da5b7982bd2287/Resource`,
      [
        {
          id: "AwsSolutions-L1",
          reason: "The resource is created automatically by CDK",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `${cdk.Stack.of(
        this
      )}/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource`,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "The resource is created automatically by CDK",
        },
      ],
      true
    );
  }
}
