/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { IVpc, Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import {
  CfnFileSystem,
  CfnStorageVirtualMachine,
  CfnVolume,
} from "aws-cdk-lib/aws-fsx";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { NagSuppressions } from "cdk-nag";
import { FsxConfig } from "../../types/type";
import { SecretValue } from 'aws-cdk-lib';

interface FSxNProps extends FsxConfig {
  vpc: Vpc | IVpc;
  adAdminSecret: Secret;
  adDnsIps: string[];
}

export class FSxN extends Construct {
  public readonly cifsVol: CfnVolume;
  public readonly ragdbVol: CfnVolume;
  public readonly svm: CfnStorageVirtualMachine;
  public readonly fsxAdminSecret: Secret;
  public readonly serviceAccountSecret: Secret;
  constructor(scope: Construct, id: string, props: FSxNProps) {
    super(scope, id);

    let privateSubnets = props.subnetIds.length > 0 
      ? props.subnetIds
      : props.vpc.privateSubnets.map((subnet) => subnet.subnetId)
    if(props.deploymentType === 'SINGLE_AZ_1'){privateSubnets = [privateSubnets[0]]}

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

  //Add alltrafic testing
    fileSystemSg.addIngressRule(Peer.ipv4(`0.0.0.0/0`), Port.allTraffic());

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

    const fsxAdminSecret = !props.fsxAdminPassword
      ? new Secret(this, "fsxAdminSecrets", {
          generateSecretString: {
            generateStringKey: "password",
            passwordLength: 32,
            requireEachIncludedType: true,
            secretStringTemplate: JSON.stringify({ username: "fsxadmin" }),
          },
        })
      : new Secret(this, "fsxAdminSecrets", {
        secretObjectValue: {
          username: SecretValue.unsafePlainText("fsxadmin"),
          password: SecretValue.unsafePlainText(props.fsxAdminPassword),
        },
      })

    this.fsxAdminSecret = fsxAdminSecret;

    const fileSystem = new CfnFileSystem(this, "FileSystem", {
      fileSystemType: "ONTAP",
      subnetIds: privateSubnets,
      storageCapacity: props.storageCapacity,
      securityGroupIds: [fileSystemSg.securityGroupId],
      ontapConfiguration: {
        deploymentType: props.deploymentType,
        throughputCapacity: props.throughputCapacity,
        fsxAdminPassword: new cdk.CfnDynamicReference(
          cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
          `${this.fsxAdminSecret.secretArn}:SecretString:password`
        ).toString(),
        preferredSubnetId: privateSubnets[0],
      },
    });

    // Service Accountのパスワード設定が空の場合は、AdAdminのパスワードを設定
    const serviceAccountSecret = !props.adConfig.serviceAccountPassword
      ? new Secret(this, "serviceAccountSecret", {
        secretObjectValue: {
          username: SecretValue.unsafePlainText(props.adConfig.serviceAccountUserName),
          password: SecretValue.unsafePlainText(new cdk.CfnDynamicReference(
            cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
            `${props.adAdminSecret.secretArn}:SecretString:password`).toString()
          ),
        },
      })
      : new Secret(this, "serviceAccountSecret", {
        secretObjectValue: {
          username: SecretValue.unsafePlainText(props.adConfig.serviceAccountUserName),
          password: SecretValue.unsafePlainText(props.adConfig.serviceAccountPassword),
        },
      })
    this.serviceAccountSecret = serviceAccountSecret
    
    const svm = new CfnStorageVirtualMachine(this, "SVM", {
      fileSystemId: fileSystem.ref,
      name: props.adConfig.svmNetBiosName,
      svmAdminPassword: new cdk.CfnDynamicReference(
        cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
        `${this.fsxAdminSecret.secretArn}:SecretString:password`
      ).toString(),
      activeDirectoryConfiguration: {
        netBiosName: props.adConfig.svmNetBiosName,
        selfManagedActiveDirectoryConfiguration: {
          dnsIps: props.adDnsIps,
          domainName: props.adConfig.adDomainName,
          userName: props.adConfig.serviceAccountUserName,
          password: new cdk.CfnDynamicReference(
            cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
            `${serviceAccountSecret.secretArn}:SecretString:password`
          ).toString(),
          organizationalUnitDistinguishedName: props.adConfig.adOu,
          fileSystemAdministratorsGroup: props.adConfig.fileSystemAdministratorsGroup
        },
      },
    });

    this.svm = svm;

    this.cifsVol = new CfnVolume(this, "BedrockRag", {
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

    this.ragdbVol = new CfnVolume(this, "RagDB", {
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
      [fileSystemSg, fsxAdminSecret,serviceAccountSecret],
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
