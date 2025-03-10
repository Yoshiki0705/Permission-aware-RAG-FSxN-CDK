/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import {
  HostedZone,
  IHostedZone,
  PublicHostedZone,
} from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface DomainProps {
  appDomainName: string;
  existingRoute53: boolean;
  construct: Construct;
}
export class DomainRegister {
  public readonly props;
  public hostedZone: IHostedZone | PublicHostedZone;

  constructor(props: DomainProps) {
    this.props = props;

    if (props.existingRoute53) {
      this.existingHostedZone();
    } else {
      this.newHostedZone();
    }
  }
  private existingHostedZone() {
    this.hostedZone = HostedZone.fromLookup(
      this.props.construct,
      "Route53Zone",
      {
        domainName: this.props.appDomainName,
      }
    );
  }

  private newHostedZone() {
    this.hostedZone = new PublicHostedZone(this.props.construct, "HostZone", {
      zoneName: this.props.appDomainName,
    });
  }
}
