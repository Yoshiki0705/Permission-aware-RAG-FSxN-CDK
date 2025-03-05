/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Network } from "./constructs/network";
import { devConfig } from "../config";
import { FSxN } from "./constructs/fsx";
import { Ad } from "./constructs/ad";

export class FSxNStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const network = new Network(this, `${id}-Network`, {
      ...devConfig.networkConfig,
    });

    const ad = new Ad(this, `${id}-Ad`, {
      vpc: network.vpc,
      ...devConfig.adConfig,
    });

    const fsx = new FSxN(this, `${id}-FSx`, {
      vpc: network.vpc,
      ad: ad.microsoftAd,
      adPassword: ad.adPasswoed,
      ...devConfig.adConfig,
    });
  }
}
