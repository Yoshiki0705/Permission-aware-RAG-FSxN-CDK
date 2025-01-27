/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { devConfig } from "../../config";
import { RemovalPolicy } from "aws-cdk-lib";
import { DatabaseConfig } from "../../types/type";

export class Database extends Construct {
  public readonly dynamo: TableV2;
  constructor(scope: Construct, id: string, props: DatabaseConfig) {
    super(scope, id);

    this.dynamo = new TableV2(this, "SessionTable", {
      ...props,
      tableName: `${devConfig.userName}-SessionTable`,
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
