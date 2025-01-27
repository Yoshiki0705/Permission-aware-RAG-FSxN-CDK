/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { Attribute, Billing } from "aws-cdk-lib/aws-dynamodb";
import { ApplicationLoadBalancedFargateServiceProps } from "aws-cdk-lib/aws-ecs-patterns";

export type Config = {
  /**
   * Username for authentication
   * @type {string}
   */
  userName: string;
  /**
   * Email of admin user for Cognito
   * @type {string}
   */
  adminEmail: string;
  /**
   * Define the identifying your stack
   * @type {string}
   */
  stackName: string;

  /**
   * Allowed ips to webapp
   * @type {string[]}
   */

  allowedIps: string[];

  /**
   * Network configuration
   * @type {NetworkConfig}
   */
  networkConfig: NetworkConfig;

  /**
   * Database configuration
   * @type {DatabaseConfig}
   */
  databaseConfig: DatabaseConfig;

  /**
   * Active Directory configuration
   * @type {AdConfig}
   */
  adConfig: AdConfig;
  /**
   * ChatApp configuration
   * @type {ChatAppConfig}
   */
  chatAppConfig: ChatAppConfig;

  /**
   * Vector configuration
   * @type {VectorConfig}
   */
  vectorConfig: VectorConfig;
};
export type NetworkConfig = {
  /**
   * Define whether use existing VPC or not
   * @type {boolean}
   */
  existingVpc: boolean;
  /**
   * Define your vpc id if using existing the vpc
   * @type {string}
   */
  vpcId?: string;
  /**
   * Vpc CIDR
   * @type {string}
   */
  cidr: string;
  /**
   * CIDR mask of `publicSubnet`,`natSubnet` and `isolatedSubnet`
   * @type {number}
   */
  cidrMask: number;
  /**
   * Define whether creating a public subnet or not
   * @type {boolean}
   */
  publicSubnet: boolean;
  /**
   * Define whether creating a nat subnet (a private subnet with NAT gateway) or not
   * @type {boolean}
   */
  natSubnet: boolean;
  /**
   * Define whether creating a isolated subnet (a private subnet without NAT gateway) or not
   * @type {boolean}
   */
  isolatedSubnet: boolean;
  /**
   * Define how many AZs in the region are created
   * @type {number}
   */
  maxAzs: number;
  /**
   * Define the Domain name in Route53 for ECS app
   * @type {string}
   */
  appDomainName: string;
  /**
   * Define whether use existing Route53 or not
   * @type {boolean}
   */
  existingRoute53: boolean;
};

export type DatabaseConfig = {
  /**
   * Partition key attribute definition.
   * @type {Attribute}
   */
  partitionKey: Attribute;
  /**
   * Sort key attribute definition.
   * @type {Attribute}
   */
  sortKey?: Attribute;
  /**
   * The billing mode and capacity settings to apply to the table.
   * @type {Billing}
   */
  billing: Billing;
  /**
   * Define the table which stores the user access information .
   * @type {string}
   */
  userAccessTable?: string;
};

export type AdConfig = {
  /**
   * Ad username
   */
  adUsername: string;
  /**
   * Organizational Unit
   * @type {string}
   */
  ou: string;
  /**
   * Domain name
   * @type {string}
   */
  domainName: string;
};

export type ChatAppConfig = {
  /**
   * Image path in your directory
   * @type {string}
   */
  imagePath: string;

  /**
   * Taf for image.
   * @type {string}
   */
  tag: string;

  /**
   * Fargate cluster config
   * @type {ApplicationLoadBalancedFargateServiceProps}
   */
  albFargateServiceProps: ApplicationLoadBalancedFargateServiceProps;
};

export type VectorConfig = {
  /**
   * Designate Aurora or AOSS as pgvector
   * @type { "aurora" | "aoss";}
   */
  vector: "aurora" | "aoss";
  /**
   * Image path in your directory
   * @type {string}
   */
  collectionName?: string;
};
