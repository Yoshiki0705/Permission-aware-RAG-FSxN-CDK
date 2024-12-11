import { Vpc,IVpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage,OperatingSystemFamily,CpuArchitecture } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { Construct } from "constructs";
import { ChatAppConfig } from "../../config";
import { ECR } from "./repository";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Bucket, BucketEncryption, StorageClass } from "aws-cdk-lib/aws-s3";
import {
  CfnServiceLinkedRole,
  Effect,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { RegionalWaf } from "./regional-waf";
import { IHostedZone, PublicHostedZone } from "aws-cdk-lib/aws-route53";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  ApplicationProtocol,
  SslPolicy,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";

interface ChatAppProps extends ChatAppConfig {
  vpc: Vpc | IVpc;
  allowedIps: string[];
  api: LambdaRestApi;
  hostZone: PublicHostedZone | IHostedZone;
  domainName: string;
  certificate: Certificate;
}

export class ChatApp extends Construct {
  constructor(scope: Construct, id: string, props: ChatAppProps) {
    super(scope, id);

    const serviceLinkedRole = new CfnServiceLinkedRole(
      this,
      "ECSServiceLinkedRole",
      {
        awsServiceName: "ecs.amazonaws.com",
      }
    );

    const cluster = new Cluster(this, "Cluster", {
      vpc: props.vpc,
      containerInsights: true,
    });
    cluster.node.addDependency(serviceLinkedRole);

    const chatAppRepository = new ECR(this, "Ecr", {
      path: `${props.imagePath}/app`,
      tag: props.tag,
    });

    const accessLoggingBucket = new Bucket(this, "AccessLogBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      enforceSSL: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(182),
            },
            {
              storageClass: StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
            {
              storageClass: StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(730),
            },
          ],
        },
      ],
    });

    const app = new ApplicationLoadBalancedFargateService(
      this,
      "Alb-Fargate-Service",
      {
        cluster,
        domainZone: props.hostZone,
        domainName: props.domainName,
        certificate: props.certificate,
        redirectHTTP: true,
        protocol: ApplicationProtocol.HTTPS,
        sslPolicy: SslPolicy.RECOMMENDED_TLS,
        taskImageOptions: {
          containerPort: 8501,
          image: ContainerImage.fromEcrRepository(
            chatAppRepository.repository,
            props.tag
          ),
          environment: {
            CHAT_URL: props.api.url,
          },
        },
        ...props.albFargateServiceProps,
	runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.X86_64
      },
      }
    );
    app.loadBalancer.logAccessLogs(accessLoggingBucket);
    app.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        actions: ["execute-api:Invoke", "execute-api:ManageConnections"],
        effect: Effect.ALLOW,
        resources: [props.api.arnForExecuteApi()],
      })
    );
    const waf = new RegionalWaf(this, "RegionalWaf", {
      allowedIps: props.allowedIps,
      webACLResourceArn: app.loadBalancer.loadBalancerArn,
    });
    waf.webAcl.addDependency(
      app.loadBalancer.node.defaultChild as cdk.CfnResource
    );

    NagSuppressions.addResourceSuppressions(
      [app, app.loadBalancer, app.taskDefinition, accessLoggingBucket],
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Given the least privilege to this role",
        },
        {
          id: "AwsSolutions-EC23",
          reason: "Restriced access with AWS WAF",
        },
        {
          id: "AwsSolutions-S1",
          reason: "This bucket is the access logging bucket",
        },
        {
          id: "AwsSolutions-ECS2",
          reason: "No security impact about this environment variable",
        },
      ],
      true
    );
  }
}
