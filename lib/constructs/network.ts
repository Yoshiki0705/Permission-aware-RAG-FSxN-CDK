import { RemovalPolicy } from "aws-cdk-lib";
import {
  FlowLogDestination,
  FlowLogTrafficType,
  IpAddresses,
  SubnetType,
  Vpc,
  VpcProps,
  IVpc,
} from "aws-cdk-lib/aws-ec2";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { isEmpty } from "lodash";
import { NetworkConfig } from "../../config";
import { IHostedZone, PublicHostedZone } from "aws-cdk-lib/aws-route53";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { DomainRegister } from "./domain";

export class Network extends Construct {
  public readonly vpc: Vpc | IVpc;
  public readonly hostZone: IHostedZone | PublicHostedZone;
  public readonly certificate: Certificate;
  constructor(scope: Construct, id: string, props: NetworkConfig) {
    super(scope, id);

    // Vpc logging - 60 days
    const cwLogs = new LogGroup(this, "VpcLogs", {
      logGroupName: `/vpc/${id}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.TWO_MONTHS,
    });

    const subnetConfiguration: VpcProps["subnetConfiguration"] = [];

    if (props.publicSubnet) {
      subnetConfiguration.push({
        cidrMask: props.cidrMask,
        name: `${id}-public-subnet`,
        subnetType: SubnetType.PUBLIC,
      });
    }

    if (props.natSubnet) {
      subnetConfiguration.push({
        cidrMask: props.cidrMask,
        name: `${id}-private-subnet`,
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      });
    }

    if (props.isolatedSubnet) {
      subnetConfiguration.push({
        cidrMask: props.cidrMask,
        name: `${id}-isolated-subnet`,
        subnetType: SubnetType.PRIVATE_ISOLATED,
      });
    }

    if (isEmpty(subnetConfiguration)) {
      throw new Error("No subnet configuration enabled");
    }

/*    // Create VPC - Private and public subnets
    this.vpc = new Vpc(this, "Vpc", {
      ipAddresses: IpAddresses.cidr(props.cidr),
      subnetConfiguration,
      maxAzs: props.maxAzs,
      flowLogs: {
        s3: {
          destination: FlowLogDestination.toCloudWatchLogs(cwLogs),
          trafficType: FlowLogTrafficType.ALL,
        },
      },
    });
*/
    this.vpc = Vpc.fromLookup(this,'ExistingVpc',{
      vpcId:"vpc-0a53be923de17d5f1",
    });

    const domain = new DomainRegister({
      construct: this,
      appDomainName: props.appDomainName,
      existingRoute53: props.existingRoute53,
    });

    this.hostZone = domain.hostedZone;

    this.certificate = new Certificate(this, "Cert", {
      domainName: props.appDomainName,
      validation: CertificateValidation.fromDns(this.hostZone),
    });
  }
}
