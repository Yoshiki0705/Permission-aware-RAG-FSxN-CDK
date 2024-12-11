#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FSxNRagStack } from "../lib/fsxn-rag-stack";
/*import { NagLogger } from "../nag/NagLogger";
import { AwsSolutionsChecks } from "cdk-nag";*/
import { UsRegionStack } from "../lib/us-region-stack";
import { devConfig } from "../config";

const app = new cdk.App();
  console.log(process.env.AWS_REGION);
  console.log(process.env.CDK_DEFAULT_REGION);
/*const logger = new NagLogger();
cdk.Aspects.of(app).add(
  new AwsSolutionsChecks({ verbose: true, additionalLoggers: [logger] })
);*/
const usStack = new UsRegionStack(app, `${devConfig.stackName}UsRegionStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  crossRegionReferences: true,
});
new FSxNRagStack(app, `${devConfig.stackName}FSxNRagStack`, {
  wafAttrArn: usStack.wafAttrArn,
  edgeFnVersion: usStack.edgeFnVersion,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});
cdk.Tags.of(app).add("cost", "netapp2");
