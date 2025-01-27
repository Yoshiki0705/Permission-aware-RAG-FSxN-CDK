/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { RemovalPolicy } from "aws-cdk-lib";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

import {
  DockerImageDeployment,
  Source,
  Destination,
} from "cdk-docker-image-deployment";
import { NagSuppressions } from "cdk-nag";

interface EcrProps {
  path: string;
  tag: string;
}
export class ECR extends Construct {
  public readonly repository: Repository;
  constructor(scope: Construct, id: string, props: EcrProps) {
    super(scope, id);
    this.repository = new Repository(this, "Repository", {
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    const dockerImageDeployment = new DockerImageDeployment(
      this,
      "deployDockerImage",
      {
        source: Source.directory(props.path),
        destination: Destination.ecr(this.repository, {
          tag: props.tag,
        }),
      }
    );
    NagSuppressions.addResourceSuppressions(
      dockerImageDeployment,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Create the Lambda and codebuild iam role for this automatically",
        },
        { id: "AwsSolutions-SF1", reason: "Create Sfn automatically" },
        { id: "AwsSolutions-SF2", reason: "Create Sfn automatically" },
        { id: "AwsSolutions-CB4", reason: "Create Codebuild automatically" },
        {
          id: "AwsSolutions-IAM4",
          reason: "Create the Lambda automatically",
        },
        {
          id: "AwsSolutions-L1",
          reason: "Create the Lambda automatically",
        },
      ],
      true
    );
  }
}
