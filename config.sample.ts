import { Attribute, AttributeType, Billing } from "aws-cdk-lib/aws-dynamodb";
import { CpuArchitecture, OperatingSystemFamily } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateServiceProps } from "aws-cdk-lib/aws-ecs-patterns";
import * as path from "path";

export type Config = {
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
   * Image path in your directory
   * @type {string}
   */
  collectionName: string;
};

export const devConfig: Config = {
  stackName: "Prototype",
  allowedIps: ["198.51.100.0/24", "192.0.2.0/24 "],
  networkConfig: {
    cidr: "10.0.0.0/16",
    cidrMask: 24,
    publicSubnet: true,
    natSubnet: true,
    isolatedSubnet: true,
    maxAzs: 2,
    appDomainName: "fsxn.example.com",
    existingRoute53: false,
  },
  adConfig: {
    adUsername: "Admin",
    ou: "OU=Computers,OU=bedrock-01,DC=bedrock-01,DC=com",
    domainName: "bedrock-01.com",
  },
  databaseConfig: {
    partitionKey: {
      name: "SessionId",
      type: AttributeType.STRING,
    },
    billing: Billing.onDemand(),
  },
  chatAppConfig: {
    imagePath: path.join(__dirname, "./", "docker"),
    tag: "latest",
    albFargateServiceProps: {
      cpu: 1024,
      memoryLimitMiB: 2048,
      desiredCount: 1,
      enableExecuteCommand: true,
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.ARM64,
      },
    },
  },
  vectorConfig: {
    collectionName: "fsxnragvector",
  },
};
