import { Construct } from "constructs";
import {
  CfnAccessPolicy,
  CfnCollection,
  CfnSecurityPolicy,
} from "aws-cdk-lib/aws-opensearchserverless";
import { VectorConfig } from "../../config";

interface VectorDBProps extends VectorConfig {
  roles: string[];
}

export class VectorDB extends Construct {
  public readonly aoss: CfnCollection;
  constructor(scope: Construct, id: string, props: VectorDBProps) {
    super(scope, id);
    this.aoss = new CfnCollection(this, "Aoss", {
      type: "VECTORSEARCH",
      name: props.collectionName,
    });

    const aossEncryptionPolicy = new CfnSecurityPolicy(
      this,
      "AossEncryptionPolicy",
      {
        type: "encryption",
        name: "encryption-policy",
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: "collection",
              Resource: [`collection/${props.collectionName}`],
            },
          ],
          AWSOwnedKey: true,
        }),
      }
    );
    this.aoss.addDependency(aossEncryptionPolicy);

    new CfnSecurityPolicy(this, "AossNetworkPolicy", {
      name: "network-policy",
      type: "network",
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: "collection",
              Resource: [`collection/${props.collectionName}`],
            },
            {
              ResourceType: "dashboard",
              Resource: [`collection/${props.collectionName}`],
            },
          ],
          AllowFromPublic: true,
        },
      ]),
    });
    new CfnAccessPolicy(this, "AossAccessPolicy", {
      name: props.collectionName,
      type: "data",
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: "index",
              Resource: [`index/${props.collectionName}/*`],
              Permission: ["aoss:*"],
            },
            {
              ResourceType: "collection",
              Resource: [`collection/${props.collectionName}`],
              Permission: ["aoss:*"],
            },
          ],
          Principal: props.roles,
        },
      ]),
    });
  }
}
