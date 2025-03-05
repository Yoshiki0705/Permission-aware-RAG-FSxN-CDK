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

const app = new cdk.App();
cdk.Tags.of(app).add("Env", devConfig.userName);
const logger = new NagLogger();
cdk.Aspects.of(app).add(
  new AwsSolutionsChecks({ verbose: true, additionalLoggers: [logger] })
);
const usStack = new UsRegionStack(app, `${devConfig.userName}UsRegionStack`, {
  stackName:'UsRegionStack',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  crossRegionReferences: true,
});

const fsxnstack = new FSxNStack(app, `${devConfig.userName}FSxNStack`, {
  stackName:'FSxNStack',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});

const computestack = new ComputeStack(app, `${devConfig.userName}ComputeStack`, {
  stackName:'ComputeStack',
  wafAttrArn: usStack.wafAttrArn,
  edgeFnVersion: usStack.edgeFnVersion,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});

computestack.addDependency(fsxnstack)