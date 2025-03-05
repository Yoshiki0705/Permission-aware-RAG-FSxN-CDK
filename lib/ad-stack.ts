/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { devConfig } from "../config";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { Network } from "./constructs/network";
import { Ad } from "./constructs/ad";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

export class AdStack extends cdk.Stack {
  public readonly vpc: Vpc|IVpc;
  public readonly adAdminSecret: Secret;
  public readonly adDnsIps: string[];

  constructor(scope: Construct, id: string, props?:
     cdk.StackProps) {
    super(scope, id, props);

    const network = new Network(this, `${id}-Vpc`, {
      ...devConfig.networkConfig,
    });
    this.vpc = network.vpc

    const ad = new Ad(this, `${id}`, {
      vpc: this.vpc,
      ...devConfig.fsxConfig,
    });
    this.adAdminSecret = ad.adAdminSecret
    if (ad.microsoftAd){
      this.adDnsIps = ad.microsoftAd.attrDnsIpAddresses
    } else {
      this.adDnsIps = devConfig.fsxConfig.adConfig.adDnsIps
    }
  }
}
