/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";

import {
  Architecture,
  DockerImageCode,
  DockerImageFunction,
  Function,
  FunctionUrlAuthType,
  HttpMethod,
  InvokeMode,
  Version,
} from "aws-cdk-lib/aws-lambda";
import { ISubnet, Subnet, Vpc } from "aws-cdk-lib/aws-ec2";
import { ECR } from "./repository";
import {
  AllowedMethods,
  CachePolicy,
  CfnDistribution,
  CfnOriginAccessControl,
  Distribution,
  GeoRestriction,
  LambdaEdgeEventType,
  OriginRequestPolicy,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { FunctionUrlOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { NagSuppressions } from "cdk-nag";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { CognitoParams } from "./auth";
import { ChatAppConfig } from "../../types/type";
import { devConfig } from "../../config";

interface VpcConfig {
  vpc: cdk.aws_ec2.Vpc;
  subnets: ISubnet[];
}

interface LambdaWebAdapterProps extends ChatAppConfig {
  wafAttrArn: string;
  edgeFnVersion: Version;
  db: TableV2;
  cognito: CognitoParams;
  vpcConfig: VpcConfig;
}

export class LambdaWebAdapter extends Construct {
  public readonly lambda: Function;
  constructor(scope: Construct, id: string, props: LambdaWebAdapterProps) {
    super(scope, id);

    const chatAppRepository = new ECR(this, "ecr", {
      path: `${props.imagePath}/nextjs`,
      tag: props.tag,
    });

    const lambda = new DockerImageFunction(this, "lambda", {
      code: DockerImageCode.fromEcr(chatAppRepository.repository, {
        tagOrDigest: props.tag,
      }),
      architecture: Architecture.X86_64,
      memorySize: 2048,
      timeout: cdk.Duration.minutes(5),
      environment: {
        USER_POOL_ID: props.cognito.userPoolId,
        USER_POOL_CLIENT_ID: props.cognito.userPoolClientId,
        IDENTITY_ID: props.cognito.identityPoolId,
        TABLE_NAME: props.db.tableName,
      },
      vpc: props.vpcConfig.vpc,
      vpcSubnets: {subnets: props.vpcConfig.subnets}
    });

    this.lambda = lambda;

    lambda.role?.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          "arn:aws:bedrock:*:*:foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*",
        ],
      })
    );
    lambda.addToRolePolicy(
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
    if (props.vpcConfig.vpc) {
      lambda.role!.addManagedPolicy(
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
        )
      );
    }
    if (devConfig.databaseConfig.userAccessTable) {
      const userAccessTable = TableV2.fromTableName(
        this,
        "UserAccessTable",
        devConfig.databaseConfig.userAccessTable!
      );
      userAccessTable.grantReadData(lambda);
      lambda.addEnvironment(
        "USER_ACCESS_TABLE_NAME",
        devConfig.databaseConfig.userAccessTable
      );
    }
    lambda.node.addDependency(chatAppRepository);

    const functionUrl = lambda.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowedMethods: [HttpMethod.ALL],
        allowedOrigins: ["*"],
      },
      invokeMode: InvokeMode.RESPONSE_STREAM,
    });

    const accessLoggingBucket = new Bucket(this, "AccessLogBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: false,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const distribution = new Distribution(this, "cloudfront", {
      webAclId: props.wafAttrArn,
      enableIpv6: false,
      geoRestriction: GeoRestriction.allowlist("JP"),
      enableLogging: true,
      logBucket: accessLoggingBucket,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new FunctionUrlOrigin(functionUrl),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        edgeLambdas: [
          {
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: props.edgeFnVersion,
            includeBody: true,
          },
        ],
      },
    });

    const oac = new CfnOriginAccessControl(this, "oac", {
      originAccessControlConfig: {
        name: devConfig.userName,
        originAccessControlOriginType: "lambda",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });

    const cfnDistribution = distribution.node.defaultChild as CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      oac.attrId
    );

    lambda.addPermission("CloudFrontLambdaIntegration", {
      principal: new ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunctionUrl",
      sourceArn: `arn:aws:cloudfront::${
        cdk.Stack.of(this).account
      }:distribution/${distribution.distributionId}`,
    });

    new cdk.CfnOutput(this, "url", {
      value: `https://${distribution.domainName}`,
    });

    NagSuppressions.addResourceSuppressions(
      [lambda.role!, distribution, accessLoggingBucket],
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Given the least privilege to this role for lambda",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Given the least privilege to this role for lambda",
        },
        {
          id: "AwsSolutions-CFR4",
          reason: "Added SecurityPolicyProtocol.TLS_V1_2_2021 to CF",
        },
        {
          id: "AwsSolutions-S1",
          reason: "This bucket is the access logging bucket",
        },
      ],
      true
    );
  }
}
