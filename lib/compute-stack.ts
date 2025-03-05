import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { devConfig } from "../config";
import { EmbeddingServer } from "./constructs/embedding-server";
import { LambdaWebAdapter } from "./constructs/lambda-web-adapter";
import { VectorDB } from "./constructs/vector";
import { Database } from "./constructs/database";
import { Auth } from "./constructs/auth";
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Version } from "aws-cdk-lib/aws-lambda";
import { NagSuppressions } from "cdk-nag";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

interface CopmuteStackProps extends cdk.StackProps {
  wafAttrArn: string;
  edgeFnVersion: Version;
}

export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string,  props: CopmuteStackProps) {
    super(scope, id, props);
    
    const vpc = Vpc.fromLookup(this, "VpcId", {
      vpcId: StringParameter.valueFromLookup(this,'VpcId'),
    });

    const adpasswd = Secret.fromSecretCompleteArn(this, "AdPasswd", cdk.Fn.importValue('AdPasswdArn'));

    const embeddingServerRole = new Role(this, `${id}-EmbeddingServerRole`, {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });
    const db = new Database(this, `${id}-Database`, {
      ...devConfig.databaseConfig,
    });

    const auth = new Auth(this, `${id}-Auth`, {
      userName: devConfig.userName,
      adminEmail: devConfig.adminEmail,
    });

    const web = new LambdaWebAdapter(this, `${id}-NextJs`, {
      ...devConfig.chatAppConfig,
      wafAttrArn: props.wafAttrArn,
      edgeFnVersion: props.edgeFnVersion,
      db: db.dynamo,
      cognito: auth.cognitoParams,
      vpc: vpc,
    });

    const vector = new VectorDB(this, `${id}-VectorSearch`, {
      roles: [
        embeddingServerRole.roleArn,
        web.lambda.role!.roleArn,
      ],
      ...devConfig.vectorConfig,
      vpc: vpc,
    });

    if (vector.db instanceof cdk.aws_rds.DatabaseCluster) {
      web.lambda.addEnvironment("SECRETS_ARN", vector.db.secret!.secretArn);
      vector.db.grantDataApiAccess(web.lambda);
      vector.db.connections.allowFrom(
        web.lambda,
        cdk.aws_ec2.Port.tcp(vector.db.clusterEndpoint.port)
      );
    } else {
      web.lambda.addEnvironment(
        "VECTOR_HOST",
        vector.db.attrCollectionEndpoint
      );
      web.lambda.addEnvironment("COLLECTION_NAME", vector.db.name);
      web.lambda.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["aoss:APIAccessAll"],
          resources: [vector.db.attrArn],
        })
      );
    }

    web.lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminRespondToAuthChallenge",
          "cognito-idp:AdminResetUserPassword",
          "cognito-idp:AdminUserGlobalSignOut",
        ],
        resources: [auth.userPool.userPoolArn],
      })
    );

    const embeddingServer = new EmbeddingServer(this, `${id}-EmbeddingSever`, {
      vpc: vpc,
      vector: vector.db,
      adSecret: adpasswd,
      role: embeddingServerRole,
      imagePath: devConfig.chatAppConfig.imagePath,
      tag: devConfig.chatAppConfig.tag,
    });
    embeddingServer.instance.node.addDependency(vector.db);

    NagSuppressions.addResourceSuppressions(
      embeddingServerRole,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Given the least privilege to this role",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Given the least privilege to this role",
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `${cdk.Stack.of(this)}/AWS679f53fac002430cb0da5b7982bd2287/Resource`,
      [
        {
          id: "AwsSolutions-L1",
          reason: "The resource is created automatically by CDK",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `${cdk.Stack.of(
        this
      )}/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource`,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "The resource is created automatically by CDK",
        },
      ],
      true
    );
  }
}
