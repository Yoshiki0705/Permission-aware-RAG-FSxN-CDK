import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  BlockDeviceVolume,
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  ISubnet,
  KeyPair,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  Vpc,
  WindowsVersion,
} from "aws-cdk-lib/aws-ec2";
import {
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { CfnAssociation } from "aws-cdk-lib/aws-ssm";
import { CfnMicrosoftAD } from "aws-cdk-lib/aws-directoryservice";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { AdConfig } from "../../config";
import { NagSuppressions } from "cdk-nag";

interface AdProps extends AdConfig {
  vpc: Vpc;
  adUsername: string;
}
export class Ad extends Construct {
  public readonly microsoftAd: CfnMicrosoftAD;
  public readonly adPasswoed: Secret;
  constructor(scope: Construct, id: string, props: AdProps) {
    super(scope, id);

    const adPassword = new Secret(this, "SecretsForMicrosoftAd", {
      generateSecretString: {
        generateStringKey: "password",
        passwordLength: 32,
        requireEachIncludedType: true,
        secretStringTemplate: JSON.stringify({ username: props.adUsername }),
      },
    });
    this.adPasswoed = adPassword;

    const ad = new CfnMicrosoftAD(this, "MicrosoftAd", {
      name: props.domainName,
      password: new cdk.CfnDynamicReference(
        cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
        `${adPassword.secretArn}:SecretString:password`
      ).toString(),
      edition: "Standard",
      vpcSettings: {
        vpcId: props.vpc.vpcId,
        subnetIds: props.vpc.privateSubnets.map((subnet) => subnet.subnetId),
      },
    });

    this.microsoftAd = ad;

    const sg = new SecurityGroup(this, "SgForInstance", {
      vpc: props.vpc,
    });

    props.vpc.isolatedSubnets.map((value: ISubnet) => {
      sg.addIngressRule(Peer.ipv4(`${value.ipv4CidrBlock}`), Port.tcp(389));
    });
    props.vpc.isolatedSubnets.map((value: ISubnet) => {
      sg.addIngressRule(Peer.ipv4(`${value.ipv4CidrBlock}`), Port.tcp(3389));
    });

    // For fleet  Manager
    const instanceRole = new Role(this, "InstanceRole", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });
    instanceRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
        ],
        resources: ["*"],
      })
    );
    instanceRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "ec2messages:AcknowledgeMessage",
          "ec2messages:DeleteMessage",
          "ec2messages:FailMessage",
          "ec2messages:GetEndpoint",
          "ec2messages:GetMessages",
          "ec2messages:SendReply",
        ],
        resources: ["*"],
      })
    );
    instanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMDirectoryServiceAccess")
    );
    instanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    const key = new KeyPair(this, "KeyForInstance", {
      keyPairName: "ad-host-key",
    });
    key.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const adHost = new Instance(this, "HostInstance", {
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.vpc.privateSubnets,
      },
      securityGroup: sg,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
      machineImage: MachineImage.latestWindows(
        WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE
      ),
      role: instanceRole,
      keyPair: key,
      requireImdsv2: true,
      blockDevices: [
        {
          volume: BlockDeviceVolume.ebs(30, {
            encrypted: true,
          }),
          deviceName: "/dev/sda1",
        },
      ],
    });

    new CfnAssociation(this, "InstanceAssociation", {
      name: "AWS-JoinDirectoryServiceDomain",
      parameters: {
        directoryId: [ad.ref],
        directoryName: [props.domainName],
        dnsIpAddresses: ad.attrDnsIpAddresses,
        directoryOU: [props.ou],
      },
      targets: [
        {
          key: "InstanceIds",
          values: [adHost.instanceId],
        },
      ],
    });

    NagSuppressions.addResourceSuppressions(
      instanceRole,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "For using AmazonSSMDirectoryServiceAccess",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Use this role for only fleet manager access",
          appliesTo: ["Resource::*"],
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressions(adHost, [
      {
        id: "AwsSolutions-EC28",
        reason: "For embedding job not accessing to the instance from user",
      },
      {
        id: "AwsSolutions-EC29",
        reason: "For embedding job not accessing to the instance from user",
      },
    ]);
    NagSuppressions.addResourceSuppressions(
      adPassword,
      [
        {
          id: "AwsSolutions-SMG4",
          reason: "No need rotation for PoC",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "GetSecretValueCommand", {
      value: `aws secretsmanager get-secret-value --secret-id ${this.adPasswoed.secretName} --profile YOUR_AWS_PROFILE`,
    });
  }
}
