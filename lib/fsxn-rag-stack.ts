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

interface FSxNRagStackProps extends cdk.StackProps {
  wafAttrArn: string;
  edgeFnVersion: Version;
}

export class FSxNRagStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FSxNRagStackProps) {
    super(scope, id, props);

    const network = new Network(this, "Network", {
      ...devConfig.networkConfig,
    });

/*    const ad = new Ad(this, "Ad", {
      vpc: network.vpc,
      ...devConfig.adConfig,
    });

    const fsx = new FSxN(this, "FSx", {
      vpc: network.vpc,
      ad: ad.microsoftAd,
      adPassword: ad.adPasswoed,
      ...devConfig.adConfig,
    });
*/
    const db = new Database(this, "Database", {
      ...devConfig.databaseConfig,
    });

    const api = new Api(this, "Api", {
      ...devConfig.chatAppConfig,
      db: db.dynamo,
      collectionName: devConfig.vectorConfig.collectionName,
    });

    const embeddingServerRole = new Role(this, "EmbeddingServerRole", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });

    const web = new LambdaWebAdapter(this, "NextJs", {
      ...devConfig.chatAppConfig,
      wafAttrArn: props.wafAttrArn,
      edgeFnVersion: props.edgeFnVersion,
      db: db.dynamo,
    });

    const vector = new VectorDB(this, "VectorSearch", {
      roles: [
        api.lambda.role!.roleArn,
        embeddingServerRole.roleArn,
        web.lambda.role!.roleArn,
      ],
      ...devConfig.vectorConfig,
    });

    web.lambda.addEnvironment("AOSS_HOST", vector.aoss.attrCollectionEndpoint);
    web.lambda.addEnvironment(
      "COLLECTION_NAME",
      devConfig.vectorConfig.collectionName
    );

    web.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["aoss:APIAccessAll"],
        resources: [vector.aoss.attrArn],
      })
    );

    api.lambda.addEnvironment("AOSS_HOST", vector.aoss.attrCollectionEndpoint);
    api.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["aoss:APIAccessAll"],
        resources: [vector.aoss.attrArn],
      })
    );

    new EmbeddingServer(this, "EmbeddingSever", {
      vpc: network.vpc,
      vector: vector.aoss,
      //adSecret: ad.adPasswoed,
      role: embeddingServerRole,
      imagePath: devConfig.chatAppConfig.imagePath,
      tag: devConfig.chatAppConfig.tag,
      //fsx: fsx,
    });

    new ChatApp(this, "ChatApp", {
      ...devConfig.chatAppConfig,
      allowedIps: devConfig.allowedIps,
      vpc: network.vpc,
      api: api.restApi,
      hostZone: network.hostZone,
      domainName: devConfig.networkConfig.appDomainName,
      certificate: network.certificate,
    });
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
  }
}
