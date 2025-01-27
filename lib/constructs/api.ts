/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import * as cdk from "aws-cdk-lib";
import {
  AuthorizationType,
  LambdaRestApi,
  LogGroupLogDestination,
  MethodLoggingLevel,
} from "aws-cdk-lib/aws-apigateway";
import {
  Architecture,
  DockerImageCode,
  DockerImageFunction,
  Function,
} from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { ECR } from "./repository";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { NagSuppressions } from "cdk-nag";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { ChatAppConfig } from "../../types/type";

interface ApiProps extends ChatAppConfig {
  db: TableV2;
  collectionName: string;
}
export class Api extends Construct {
  public readonly restApi: LambdaRestApi;
  public readonly lambda: Function;
  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const lambdaRepository = new ECR(this, "ecr", {
      path: `${props.imagePath}/lambda`,
      tag: props.tag,
    });

    this.lambda = new DockerImageFunction(this, "lambda", {
      code: DockerImageCode.fromEcr(lambdaRepository.repository, {
        tagOrDigest: props.tag,
      }),
      architecture: Architecture.ARM_64,
      memorySize: 2048,
      timeout: cdk.Duration.minutes(5),
      environment: {
        COLLECTION_NAME: props.collectionName,
      },
    });

    this.lambda.node.addDependency(lambdaRepository);
    this.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "bedrock:GetFoundationModel",
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          cdk.Stack.of(this).region === "us-east-1"
            ? `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`
            : `arn:aws:bedrock:${
                cdk.Stack.of(this).region
              }::foundation-model/*`,
          "arn:aws:bedrock:us-east-1::foundation-model/*",
        ],
      })
    );
    this.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "dynamodb:ListTables",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
        ],
        resources: [props.db.tableArn],
      })
    );

    const accessLogGroup = new LogGroup(this, "AccessLog");

    this.restApi = new LambdaRestApi(this, "LambdaRestApi", {
      handler: this.lambda,
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY,
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        tracingEnabled: true,
        accessLogDestination: new LogGroupLogDestination(accessLogGroup),
      },
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });

    NagSuppressions.addResourceSuppressions(
      [this.lambda.role!, this.restApi],
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Given the least privilege to this role",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Given the least privilege to this role",
        },
        {
          id: "AwsSolutions-COG4",
          reason: "No use of Cognito",
        },
        {
          id: "AwsSolutions-APIG2",
          reason: "No need the setting for PoC",
        },
        {
          id: "AwsSolutions-APIG3",
          reason: "IAM Auth instead of WAF for security",
        },
      ],
      true
    );
  }
}
