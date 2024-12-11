import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import {
  CfnFileSystem,
  CfnStorageVirtualMachine,
  CfnVolume,
} from "aws-cdk-lib/aws-fsx";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { CfnMicrosoftAD } from "aws-cdk-lib/aws-directoryservice";
import { AdConfig } from "../../config";
import { NagSuppressions } from "cdk-nag";

interface FSxNProps extends AdConfig {
  vpc: Vpc;
  ad: CfnMicrosoftAD;
  adPassword: Secret;
}
export class FSxN extends Construct {
  public readonly bedrockRagVolume: CfnVolume;
  public readonly ragdbVolume: CfnVolume;
  public readonly svm: CfnStorageVirtualMachine;
  public readonly fsxPassword: Secret;
  constructor(scope: Construct, id: string, props: FSxNProps) {
    super(scope, id);

    const privateSubnets = props.vpc.privateSubnets.map(
      (subnet) => subnet.subnetId
    );

    const fileSystemSg = new SecurityGroup(this, "SgForFSxN", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });
    // https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/limit-access-security-groups.html
    const tcpList = [
      22, 111, 135, 139, 161, 162, 443, 445, 635, 749, 2049, 3260, 4045, 4046,
      10000, 11104, 11105,
    ];
    const udpList = [111, 135, 137, 139, 161, 162, 635, 2049, 4045, 4046, 4049];

    fileSystemSg.addIngressRule(
      Peer.ipv4(props.vpc.vpcCidrBlock),
      Port.icmpPing(),
      "Pinging the instance"
    );
    tcpList.map((port) => {
      fileSystemSg.addIngressRule(
        Peer.ipv4(props.vpc.vpcCidrBlock),
        Port.tcp(port)
      );
    });

    udpList.map((port) => {
      fileSystemSg.addIngressRule(
        Peer.ipv4(props.vpc.vpcCidrBlock),
        Port.udp(port)
      );
    });

    const fsxPassword = new Secret(this, "SecretsForFsx", {
      generateSecretString: {
        generateStringKey: "password",
        passwordLength: 32,
        requireEachIncludedType: true,
        secretStringTemplate: JSON.stringify({ username: "fsxadmin" }),
      },
    });

    this.fsxPassword = fsxPassword;

    const fileSystem = new CfnFileSystem(this, "FileSystem", {
      fileSystemType: "ONTAP",
      subnetIds: privateSubnets,
      storageCapacity: 2048,
      securityGroupIds: [fileSystemSg.securityGroupId],
      ontapConfiguration: {
        deploymentType: "MULTI_AZ_1",
        throughputCapacity: 512,
        fsxAdminPassword: new cdk.CfnDynamicReference(
          cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
          `${fsxPassword.secretArn}:SecretString:password`
        ).toString(),
        routeTableIds: props.vpc.privateSubnets.map(
          (subnet) => subnet.routeTable.routeTableId
        ),
        preferredSubnetId: privateSubnets[0],
      },
    });
    const svm = new CfnStorageVirtualMachine(this, "SVM", {
      fileSystemId: fileSystem.ref,
      name: "brsvm",
      svmAdminPassword: new cdk.CfnDynamicReference(
        cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
        `${fsxPassword.secretArn}:SecretString:password`
      ).toString(),
      activeDirectoryConfiguration: {
        netBiosName: "BRSVM",
        selfManagedActiveDirectoryConfiguration: {
          dnsIps: props.ad.attrDnsIpAddresses,
          domainName: props.domainName,
          userName: "Admin",
          password: new cdk.CfnDynamicReference(
            cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
            `${props.adPassword.secretArn}:SecretString:password`
          ).toString(),
          fileSystemAdministratorsGroup: "AWS Delegated Administrators",
          organizationalUnitDistinguishedName: props.ou,
        },
      },
    });

    this.svm = svm;

    this.bedrockRagVolume = new CfnVolume(this, "BedrockRag", {
      name: "bedrockrag",
      ontapConfiguration: {
        storageVirtualMachineId: svm.ref,
        junctionPath: "/bedrockrag",
        sizeInMegabytes: "1024",
        storageEfficiencyEnabled: "true",
        securityStyle: "MIXED",
      },
      volumeType: "ONTAP",
    });

    this.ragdbVolume = new CfnVolume(this, "RagDB", {
      name: "ragdb",
      ontapConfiguration: {
        storageVirtualMachineId: svm.ref,
        junctionPath: "/ragdb",
        sizeInMegabytes: "1024",
        storageEfficiencyEnabled: "true",
        securityStyle: "UNIX",
      },
      volumeType: "ONTAP",
    });

    NagSuppressions.addResourceSuppressions(
      [fileSystemSg, fsxPassword],
      [
        {
          id: "AwsSolutions-SMG4",
          reason: "Need for FSxN ONTAP mount",
        },
        {
          id: "AwsSolutions-EC23",
          reason: "Need for FSxN ONTAP mount",
        },
        {
          id: "AwsSolutions-SMG4",
          reason: "No need rotation for PoC",
        },
      ],
      true
    );
  }
}
