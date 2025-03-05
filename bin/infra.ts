#!/usr/bin/env node
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NagLogger } from "../nag/NagLogger";
import { AwsSolutionsChecks } from "cdk-nag";
import { UsRegionStack } from "../lib/us-region-stack";
import { FSxNStack } from "../lib/fsxn-stack";
import { ComputeStack } from "../lib/compute-stack";
import { devConfig } from "../config";
import { AdStack } from "../lib/ad-stack";

const app = new cdk.App();
cdk.Tags.of(app).add("Env", devConfig.userName);
const logger = new NagLogger();
cdk.Aspects.of(app).add(
  new AwsSolutionsChecks({ verbose: true, additionalLoggers: [logger] })
);

const usStack = new UsRegionStack(app, `${devConfig.userName}Us`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  crossRegionReferences: true,
});

// VPCとAD、AD管理用インスタンスの作成
const adStack =  new AdStack(app, `${devConfig.userName}Ad`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});

// FSxNの作成（ADにサービスアカウントの作成が必要）※ManagedADの場合,Adminユーザーを利用
const fsxnStack = new FSxNStack(app, `${devConfig.userName}FSx`, {
  vpc: adStack.vpc,
  adAdminSecret: adStack.adAdminSecret,
  adDnsIps: adStack.adDnsIps,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});
fsxnStack.addDependency(adStack)
cdk.Tags.of(fsxnStack).add("Name", `fsxn_${devConfig.userName}`);

// Lambda等の作成
const computeStack = new ComputeStack(app, `${devConfig.userName}Compute`, {
  vpc: adStack.vpc,
  adAdminSecret: adStack.adAdminSecret,
  wafAttrArn: usStack.wafAttrArn,
  edgeFnVersion: usStack.edgeFnVersion,
  cifsVol: fsxnStack.cifsVol,
  ragdbVol: fsxnStack.ragdbVol,
  svm: fsxnStack.svm,
  fsxAdminSecret: fsxnStack.fsxAdminSecret,
  serviceAccountSecret: fsxnStack.serviceAccountSecret,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});
computeStack.addDependency(adStack)
computeStack.addDependency(fsxnStack)
