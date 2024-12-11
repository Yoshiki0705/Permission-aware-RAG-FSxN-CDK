import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  ISubnet,
  KeyPair,
  LaunchTemplate,
  LaunchTemplateHttpTokens,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  UserData,
  Vpc,
  IVpc,
} from "aws-cdk-lib/aws-ec2";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { CfnMicrosoftAD } from "aws-cdk-lib/aws-directoryservice";
import { CfnCollection } from "aws-cdk-lib/aws-opensearchserverless";
import { ECR } from "./repository";
import { FSxN } from "./fsx";
import { CfnVolume } from "aws-cdk-lib/aws-fsx";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { NagSuppressions } from "cdk-nag";

interface EmbeddingServerProps extends cdk.StackProps {
  vpc: Vpc | IVpc;
  vector: CfnCollection;
/*  adSecret: Secret; */
  role: Role;
  imagePath: string;
  tag: string;
/*  fsx: FSxN;*/
}
export class EmbeddingServer extends Construct {
  public readonly microsoftAd: CfnMicrosoftAD;
  constructor(scope: Construct, id: string, props: EmbeddingServerProps) {
    super(scope, id);
    const embeddingRepository = new ECR(this, "Ecr", {
      path: `${props.imagePath}/embed`,
      tag: props.tag,
    });
    const sg = new SecurityGroup(this, "Sg", {
      vpc: props.vpc,
    });

    props.vpc.isolatedSubnets.map((value: ISubnet) => {
      sg.addIngressRule(Peer.ipv4(`${value.ipv4CidrBlock}`), Port.tcp(389));
    });

    const instanceRole = props.role;

    // For fleet  Manager

    instanceRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "ssm:DescribeAssociation",
          "ssm:GetDeployablePatchSnapshotForInstance",
          "ssm:GetDocument",
          "ssm:DescribeDocument",
          "ssm:GetManifest",
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:ListAssociations",
          "ssm:ListInstanceAssociations",
          "ssm:PutInventory",
          "ssm:PutComplianceItems",
          "ssm:PutConfigurePackageResult",
          "ssm:UpdateAssociationStatus",
          "ssm:UpdateInstanceAssociationStatus",
          "ssm:UpdateInstanceInformation",
        ],
        resources: ["*"],
      })
    );
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
    instanceRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "fsx:DescribeStorageVirtualMachines",
          "fsx:DescribeFileSystems",
        ],
        resources: ["*"],
      })
    );
    instanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMDirectoryServiceAccess")
    );
    instanceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "aoss:APIAccessAll",
          "aoss:CreateAccessPolicy",
          "aoss:CreateSecurityPolicy",
          "aoss:CreateCollection",
        ],
        resources: [props.vector.attrArn],
      })
    );
    instanceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["bedrock:GetFoundationModel", "bedrock:InvokeModel"],
        resources: [
          cdk.Stack.of(this).region === "us-east-1"
            ? `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`
            : `arn:aws:bedrock:${
                cdk.Stack.of(this).region
              }::foundation-model/*`,
          "arn:aws:bedrock:us-east-1::foundation-model/*",
        ],
      })
    );
    instanceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"],
        resources: [embeddingRepository.repository.repositoryArn],
      })
    );
    instanceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "aoss:ListCollections",
          "aoss:BatchGetCollection",
          "ecr:GetAuthorizationToken",
          "sts:GetCallerIdentity",
        ],
        resources: ["*"],
      })
    );

/*    instanceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [props.adSecret.secretArn],
      })
    );
*/
    const key = new KeyPair(this, "Key");
    key.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

/*    const ontapConfigProperty = props.fsx.ragdbVolume
      .ontapConfiguration as CfnVolume.OntapConfigurationProperty;
*/
    const userData = UserData.forLinux({ shebang: "#!/bin/sh" });
    userData.addCommands(
      "set -ex",
      "sudo yum update -y",
      "sudo yum install -y cifs-utils python3-pip jq",
      "sudo amazon-linux-extras install docker -y",
      "sudo service docker start",
      "sudo usermod -a -G docker ec2-user",
      "sudo mkdir /tmp/data",
      "sudo mkdir /tmp/db",
      "pip3 install boto3",

/*      `echo 'import boto3
import json

def get_secret():
    secretsmanager = boto3.client("secretsmanager", region_name="${
      cdk.Stack.of(this).region
    }")
    response = secretsmanager.get_secret_value(SecretId="${
      props.adSecret.secretArn
    }")
    secret = json.loads(response["SecretString"])
    return secret["password"]

print(get_secret())' > /tmp/get_password.py`,
      "chmod +x /tmp/get_password.py",
      'echo "Starting script execution..."',
      "python3 --version",
      "which python3",
      "ls -la /tmp/get_password.py",

      "if ! python3 /tmp/get_password.py; then",
      '  echo "Failed to get password"',
      "  exit 1",
      "fi",

      // パスワードを取得して環境変数に設定
      "AD_PASSWORD=$(python3 /tmp/get_password.py)",

      'AD_PASSWORD="b?ei)Wd&XPsZGk9NW5XF;@?RNXUc-LuC1"',
      'echo "Password retrieved successfully"',
      `echo 'import boto3
fsx = boto3.client("fsx",region_name="${cdk.Stack.of(this).region}")
//response = fsx.describe_storage_virtual_machines(StorageVirtualMachineIds=["${
//        props.fsx.svm.ref
//      }"]) 
response = fsx.describe_storage_virtual_machines(StorageVirtualMachineIds=["svm-0712d1d3bd3f5402e"])
print(response["StorageVirtualMachines"][0]["Endpoints"]["Smb"]["IpAddresses"][0])' > /tmp/get_svm_endpoint.py`,

      "chmod +x /tmp/get_svm_endpoint.py",
      'echo "Starting script execution..."',
      "ls -la /tmp/get_svm_endpoint.py",

      "if ! python3 /tmp/get_svm_endpoint.py; then",
      '  echo "Failed to get password"',
      "  exit 1",
      "fi",
      "SMB_IP=$(python3 /tmp/get_svm_endpoint.py)",
*/
      "SMB_IP=192.168.128.145",
/*      `sudo mount -t cifs //$SMB_IP/c$/${props.fsx.bedrockRagVolume.name} /tmp/data -o user=Admin,password="$AD_PASSWORD",domain=bedrock-01.com,iocharset=utf8,mapchars,mfsymlinks`,*/
      `sudo mount -t cifs //192.168.128.145/Cache /tmp/data -o 'user=Administrator,password=b?ei)Wd&XPsZGk9NW5XF;@?RNXUc-LuC1,domain=netappdemo.jp,iocharset=utf8,mapchars,mfsymlinks'`,
/*      `sudo mount -t nfs ${props.fsx.svm.attrStorageVirtualMachineId}.${
        props.fsx.svm.fileSystemId
      }.fsx.${cdk.Stack.of(this).region}.amazonaws.com:${
        ontapConfigProperty.junctionPath
      } /tmp/db`,*/
/*      `sudo mount -t nfs svm-0712d1d3bd3f5402e.fs-0623d97a7e45fbe64.fsx.ap-northeast-1.amazonaws.com:/CIFScachevol1_cache /tmp/db`, */
      `sudo aws ecr get-login-password --region ${
        cdk.Stack.of(this).region
      } | sudo docker login --username AWS --password-stdin ${
        cdk.Stack.of(this).account
      }.dkr.ecr.${cdk.Stack.of(this).region}.amazonaws.com`,
      `sudo docker run -d -v /tmp/data:/opt/netapp/ai/data -v /tmp/db:/opt/netapp/ai/db -e ENV_REGION="${
        cdk.Stack.of(this).region
      }" -e ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME="${props.vector.name}" ${
        embeddingRepository.repository.repositoryUri
      }:latest`,
      "docker logs $(docker ps -aq | head -n1)"
    );

    const embeddingServer = new Instance(this, "Instance", {
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.vpc.isolatedSubnets,
      },
      securityGroup: sg,
      instanceType: InstanceType.of(InstanceClass.M5, InstanceSize.LARGE),
      machineImage: MachineImage.fromSsmParameter(
        "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-ebs"
      ),
      role: instanceRole,
      keyPair: key,
      userData: userData,
    });

    const launchTemplate = new LaunchTemplate(this, "MetadataOptionsTemplate", {
      httpTokens: LaunchTemplateHttpTokens.REQUIRED,
      httpPutResponseHopLimit: 2,
      requireImdsv2: true,
    });
    embeddingServer.instance.launchTemplate = {
      version: launchTemplate.versionNumber,
      launchTemplateId: launchTemplate.launchTemplateId,
    };

    NagSuppressions.addResourceSuppressions(
      instanceRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Use this role for only fleet manager access",
          appliesTo: ["Resource::*"],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(embeddingServer, [
      {
        id: "AwsSolutions-EC26",
        reason: "For FSxN mount",
      },
      {
        id: "AwsSolutions-EC28",
        reason: "For embedding job not accessing to the instance from user",
      },
      {
        id: "AwsSolutions-EC29",
        reason: "For embedding job not accessing to the instance from user",
      },
    ]);
  }
}
