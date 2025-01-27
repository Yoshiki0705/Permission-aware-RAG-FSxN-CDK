/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { Construct } from "constructs";
import {
  CfnAccessPolicy,
  CfnCollection,
  CfnSecurityPolicy,
} from "aws-cdk-lib/aws-opensearchserverless";
import { devConfig } from "../../config";
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  DatabaseCluster,
  DatabaseClusterEngine,
} from "aws-cdk-lib/aws-rds";
import { IVpc, Port, Vpc } from "aws-cdk-lib/aws-ec2";
import { CustomResource, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Provider } from "aws-cdk-lib/custom-resources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import {
  CompositePrincipal,
  ManagedPolicy,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { VectorConfig } from "../../types/type";

interface VectorDBProps extends VectorConfig {
  roles: string[];
  vpc?: Vpc | IVpc;
}

export class VectorDB extends Construct {
  public readonly db: CfnCollection | DatabaseCluster;
  constructor(scope: Construct, id: string, props: VectorDBProps) {
    super(scope, id);
    if (props.vector === "aurora") {
      const aurora = new DatabaseCluster(this, "AuroraServerless", {
        engine: DatabaseClusterEngine.auroraPostgres({
          version: AuroraPostgresEngineVersion.VER_16_6,
        }),
        writer: ClusterInstance.serverlessV2("writer", {
          scaleWithWriter: true,
        }),
        readers: [
          ClusterInstance.serverlessV2("reader", {
            scaleWithWriter: true,
          }),
        ],
        serverlessV2MinCapacity: 0,
        vpc: props.vpc,
        vpcSubnets: {
          subnets: props.vpc?.isolatedSubnets,
        },
        enableDataApi: true,
        removalPolicy: RemovalPolicy.DESTROY,
        iamAuthentication: true,
        storageEncrypted: true,
      });

      aurora.addRotationSingleUser();

      const setupFnRole = new Role(this, `${id}-SetupFnRole`, {
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("lambda.amazonaws.com")
        ),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaBasicExecutionRole"
          ),
          ManagedPolicy.fromAwsManagedPolicyName("AWSLambda_FullAccess"),
          ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaVPCAccessExecutionRole"
          ),
        ],
      });

      const pgVectorSetupFn = new NodejsFunction(this, "PgvectorSetupFn", {
        runtime: Runtime.NODEJS_22_X,
        entry: "./lambda/pgvector/index.ts",
        handler: "handler",
        awsSdkConnectionReuse: false,
        timeout: Duration.minutes(1),
        environment: {
          RDS_ARN: aurora.clusterArn,
          RDS_SECRET_ARN: aurora.secret!.secretArn,
        },
        vpc: props.vpc,
        vpcSubnets: {
          subnets: props.vpc!.isolatedSubnets,
        },
        role: setupFnRole,
      });
      aurora.secret!.grantRead(pgVectorSetupFn);

      aurora.connections.allowFrom(
        pgVectorSetupFn,
        Port.tcp(aurora.clusterEndpoint.port)
      );
      aurora.grantDataApiAccess(pgVectorSetupFn);

      const provider = new Provider(this, "CustomProvider", {
        onEventHandler: pgVectorSetupFn,
      });

      const cr = new CustomResource(this, "SetupPgvector", {
        serviceToken: provider.serviceToken,
      });
      cr.node.addDependency(aurora);

      this.db = aurora;

      NagSuppressions.addResourceSuppressions(
        [setupFnRole],
        [
          {
            id: "AwsSolutions-IAM4",
            reason: "Given the least privilege to this role for lambda",
          },
          {
            id: "AwsSolutions-IAM5",
            reason: "Given the least privilege to this role for lambda",
          },
        ],
        true
      );
      NagSuppressions.addResourceSuppressions(
        [provider],
        [
          {
            id: "AwsSolutions-IAM4",
            reason: "The role created automatically by CDK",
          },
          {
            id: "AwsSolutions-IAM5",
            reason: "The role created automatically by CDK",
          },
          {
            id: "AwsSolutions-L1",
            reason: "The role created automatically by CDK",
          },
        ],
        true
      );
      NagSuppressions.addResourceSuppressions(
        [aurora],
        [
          {
            id: "AwsSolutions-RDS10",
            reason:
              "Disable for PoC. You should enable it if deploying the app in production environment",
          },
        ],
        true
      );
    } else {
      const aoss = new CfnCollection(this, "Aoss", {
        type: "VECTORSEARCH",
        name: `${devConfig.userName}-${props.collectionName}`,
      });

      const aossEncryptionPolicy = new CfnSecurityPolicy(
        this,
        "AossEncryptionPolicy",
        {
          type: "encryption",
          name: `${devConfig.userName}-encryption-policy`,
          policy: JSON.stringify({
            Rules: [
              {
                ResourceType: "collection",
                Resource: [
                  `collection/${devConfig.userName}-${props.collectionName}`,
                ],
              },
            ],
            AWSOwnedKey: true,
          }),
        }
      );
      aoss.addDependency(aossEncryptionPolicy);

      new CfnSecurityPolicy(this, "AossNetworkPolicy", {
        name: `${devConfig.userName}-network-policy`,
        type: "network",
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: "collection",
                Resource: [
                  `collection/${devConfig.userName}-${props.collectionName}`,
                ],
              },
              {
                ResourceType: "dashboard",
                Resource: [
                  `collection/${devConfig.userName}-${props.collectionName}`,
                ],
              },
            ],
            AllowFromPublic: true,
          },
        ]),
      });
      new CfnAccessPolicy(this, "AossAccessPolicy", {
        name: `${devConfig.userName}-access-policy`,
        type: "data",
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: "index",
                Resource: [
                  `index/${devConfig.userName}-${props.collectionName}/*`,
                ],
                Permission: ["aoss:*"],
              },
              {
                ResourceType: "collection",
                Resource: [
                  `collection/${devConfig.userName}-${props.collectionName}`,
                ],
                Permission: ["aoss:*"],
              },
            ],
            Principal: props.roles,
          },
        ]),
      });
      this.db = aoss;
    }
  }
}
