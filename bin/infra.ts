#!/usr/bin/env node
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FSxNRagStack } from "../lib/fsxn-rag-stack";
import { NagLogger } from "../nag/NagLogger";
import { AwsSolutionsChecks } from "cdk-nag";
import { UsRegionStack } from "../lib/us-region-stack";
import { devConfig } from "../config";

const app = new cdk.App();
cdk.Tags.of(app).add("Env", devConfig.userName);
const logger = new NagLogger();
cdk.Aspects.of(app).add(
  new AwsSolutionsChecks({ verbose: true, additionalLoggers: [logger] })
);
const usStack = new UsRegionStack(app, `${devConfig.userName}UsRegionStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  crossRegionReferences: true,
});
new FSxNRagStack(app, `${devConfig.userName}FSxNRagStack`, {
  wafAttrArn: usStack.wafAttrArn,
  edgeFnVersion: usStack.edgeFnVersion,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});
