/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { AttributeType, Billing } from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";

import { Config } from "./types/type";
import { CpuArchitecture, OperatingSystemFamily } from "aws-cdk-lib/aws-ecs";

export const devConfig: Config = {
  userName: "user01",
  adminEmail: "user01@example.com",
  stackName: "Prototype",
  allowedIps: ["198.51.100.0/24", "192.0.2.0/24 "],
  networkConfig: {
    existingVpc: false,
    vpcId: "",
    cidr: "10.0.0.0/16",
    cidrMask: 24,
    publicSubnet: true,
    natSubnet: true,
    isolatedSubnet: true,
    maxAzs: 2,
    appDomainName: "fsxn.hiroshima-u.ac.jp",
    existingRoute53: false,
  },
  adConfig: {
    adUsername: "Admin",
    ou: "OU=Computers,OU=bedrock-01,DC=bedrock-01,DC=com",
    domainName: "bedrock-01.com",
  },
  databaseConfig: {
    partitionKey: {
      name: "SessionId",
      type: AttributeType.STRING,
    },
    billing: Billing.onDemand(),
    userAccessTable: "user-access-table",
  },
  chatAppConfig: {
    imagePath: path.join(__dirname, "./", "docker"),
    tag: "latest",
    albFargateServiceProps: {
      cpu: 1024,
      memoryLimitMiB: 2048,
      desiredCount: 1,
      enableExecuteCommand: true,
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.ARM64,
      },
    },
  },
  vectorConfig: {
    vector: "aurora",
    collectionName: "fsxnragvector",
  },
};
