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
  adminEmail: "user01@netappdemo.be",
  stackName: "Prototype",
  allowedIps: ["202.3.127.4/32"],
  networkConfig: {
    existingVpc: true,
    vpcId: "vpc-08869490ebfad92e8",
    cidr: "10.0.0.0/16",
    cidrMask: 24,
    publicSubnet: true,
    natSubnet: true,
    isolatedSubnet: true,
    maxAzs: 2,
    appDomainName: "fsxn.netappdemo.be", // 現状未使用？
    existingRoute53: true, // 現状未使用？
  },
  fsxConfig: {
    subnetIds: [], //空の場合はnetworkConfigで指定されたNetworkのPrivate Subnet上に構築
    storageCapacity: 1024,
    deploymentType: "SINGLE_AZ_1", // SINGLE_AZ_1 or MULTI_AZ_1
    throughputCapacity: 128,
    fsxAdminPassword:"Netapp1!", // 空の場合は自動生成して、Secret Managerに格納
    adConfig:{
      existingAd: true,
      svmNetBiosName: "svm",
      adDnsIps: ["10.0.3.103","10.0.2.207"], // existingAd flaseの場合は、ManagedADを構築して、StringParameterに格納
      adDomainName: "netappdemo.be",
      adAdminPassword: "Netapp1!", // 空の場合は自動生成して、Secret Managerに格納
      serviceAccountUserName: "Admin", // Embedding Serverのマウント用ユーザー名もこちらから引っ張ってます
      serviceAccountPassword: "", // 空の場合はSecret ManagerのadAdminPasswordの値を利用
      adOu: "OU=Computers,OU=netappdemo,DC=netappdemo,DC=be",
      fileSystemAdministratorsGroup: "AWS Delegated Administrators", //委任されたファイルシステム管理者グループ。ファイルシステムを管理できるAD内のグループの名前。デフォルトでは、これは「Domain admins」です。
    }
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
    lambdaVpcId:"vpc-0c76d3db311ac8b61",
    lambdaVpcSubnets:[{subnetId: "subnet-0b0ac9e942020b672",availabilityZone:"use1-az5"},{subnetId: "subnet-085b22a05300efd63",availabilityZone:"use1-az3"}], //subnetIdsとvpcId両方指定が必要。Lambdaの制限でPublicSubnetはエラー。（allowPublicSubnetをつければ回避は可能）Aurora/Embedding Serverも同一サブネット指定となるが、Aurora Cluster側の制限でSubnetは2つ以上必要。
    albFargateServiceProps: { //以下は現在未使用
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
