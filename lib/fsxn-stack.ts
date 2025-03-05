/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { devConfig } from "../config";
import { FSxN } from "./constructs/fsx";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { CfnMicrosoftAD } from "aws-cdk-lib/aws-directoryservice";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  CfnStorageVirtualMachine,
  CfnVolume,
} from "aws-cdk-lib/aws-fsx";

interface FSxStackProp extends cdk.StackProps {
  vpc:  Vpc|IVpc;
  managedAd?: CfnMicrosoftAD;
  adAdminSecret: Secret;
  adDnsIps: string[];
}

export class FSxNStack extends cdk.Stack {
  public readonly cifsVol: CfnVolume;
  public readonly ragdbVol: CfnVolume;
  public readonly svm: CfnStorageVirtualMachine;
  public readonly fsxAdminSecret: Secret;
  public readonly serviceAccountSecret: Secret;
  constructor(scope: Construct, id: string, props: FSxStackProp) {
    super(scope, id, props);
    const fsx = new FSxN(this, `${id}`, {
      vpc: props.vpc,
      adAdminSecret: props.adAdminSecret,
      adDnsIps: props.adDnsIps,
      ...devConfig.fsxConfig,
    });
    this.cifsVol = fsx.cifsVol
    this.ragdbVol = fsx.ragdbVol
    this.svm = fsx.svm
    this.fsxAdminSecret = fsx.fsxAdminSecret
    this.serviceAccountSecret = fsx.serviceAccountSecret
  }
}
