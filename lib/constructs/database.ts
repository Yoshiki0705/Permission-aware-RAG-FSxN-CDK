import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { DatabaseConfig } from "../../config";
import { RemovalPolicy } from "aws-cdk-lib";

export class Database extends Construct {
  public readonly dynamo: TableV2;
  constructor(scope: Construct, id: string, props: DatabaseConfig) {
    super(scope, id);

    this.dynamo = new TableV2(this, "SessionTable", {
      ...props,
      tableName: "SessionTable",
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
