/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Network } from "./constructs/network-only";
import { devConfig } from "../config";

export class NetworkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new Network(this, `${id}-Network`, {
      ...devConfig.networkConfig,
    });
  }
}
