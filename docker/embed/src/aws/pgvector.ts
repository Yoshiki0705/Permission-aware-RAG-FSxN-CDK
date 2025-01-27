/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import {
  RDSDataClient,
  BatchExecuteStatementCommand,
  SqlParameter,
  Field,
} from "@aws-sdk/client-rds-data";
import { ConfiguredRetryStrategy } from "@smithy/util-retry";

import {
  DistanceStrategy,
  PGVectorStore,
} from "@langchain/community/vectorstores/pgvector";
import { PoolConfig } from "pg";
import { getSecretValue } from "./secrets";
import { ExtendedMetadata } from "../types/metadata";
import { BedrockEmbeddings } from "@langchain/aws";

type DBSecrets = {
  dbClusterIdentifier: string;
  password: string;
  engine: string;
  port: number;
  host: string;
  username: string;
};

export function initDBClient(region) {
  const client = new RDSDataClient({
    region,
    retryStrategy: new ConfiguredRetryStrategy(
      5,
      (attempt: number) => 100 + attempt * 2000
    ),
  });
  return client;
}

export async function batchUpdate(
  ids: { id: string }[],
  data: string[],
  region: string
) {
  const secretValue = await getSecretValue(region, process.env.ENV_SECRETS_ARN);

  const secrets: DBSecrets = JSON.parse(secretValue as string);
  const aclJsonString = JSON.stringify(data);

  const parameterSets: SqlParameter[][] = ids.map((id) => [
    {
      name: "id",
      value: {
        stringValue: id.id,
      } as Field,
    },
    { name: "acl", value: { stringValue: aclJsonString } as Field },
  ]);

  const command = new BatchExecuteStatementCommand({
    resourceArn: process.env.ENV_RDS_ARN,
    secretArn: process.env.ENV_SECRETS_ARN,
    database: secrets.username || "postgres",
    sql: `
      UPDATE documents 
      SET metadata = jsonb_set(metadata, '{doc,acl}', :acl::jsonb)
      WHERE id = UUID(:id)
    `,
    parameterSets,
  });

  const client = initDBClient(region);

  try {
    const res = await client.send(command);
    console.log(res);
  } catch (error) {
    console.error("Bulk update ACL error:", error);
    throw error;
  }
}

export async function batchDelete(ids: string[], region: string) {
  const secretValue = await getSecretValue(region, process.env.ENV_SECRETS_ARN);

  const secrets: DBSecrets = JSON.parse(secretValue as string);
  console.log(ids);

  const parameterSets: SqlParameter[][] = ids.map((id) => [
    {
      name: "id",
      value: {
        stringValue: id,
      } as Field,
    },
  ]);

  const command = new BatchExecuteStatementCommand({
    resourceArn: process.env.ENV_RDS_ARN,
    secretArn: process.env.ENV_SECRETS_ARN,
    database: secrets.engine || "postgres",
    sql: "DELETE FROM documents WHERE id = UUID(:id)",
    parameterSets,
  });
  const client = initDBClient(region);

  try {
    const res = await client.send(command);
    console.log(res);
  } catch (error) {
    console.error("Bulk delete error:", error);
    throw error;
  }
}

export async function addIndexDocument(
  data: {
    vector_field: number[];
    text: string;
    metadata: ExtendedMetadata;
  },
  embeddings: BedrockEmbeddings,
  region: string,
  uuid: string
) {
  const secretValue = await getSecretValue(region, process.env.ENV_SECRETS_ARN);

  const secrets: DBSecrets = JSON.parse(secretValue as string);
  const hnswConfig = {
    postgresConnectionOptions: {
      type: "postgres",
      host: secrets.host,
      port: secrets.port,
      user: secrets.username,
      password: secrets.password,
      database: secrets.engine || "postgres",
    } as PoolConfig,
    tableName: "documents",
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
    // supported distance strategies: cosine (default), innerProduct, or euclidean
    distanceStrategy: "cosine" as DistanceStrategy,
  };

  const hnswPgVectorStore = await PGVectorStore.initialize(
    embeddings,
    hnswConfig
  );

  console.log(uuid);
  await hnswPgVectorStore.addDocuments(
    [{ pageContent: data.text, metadata: data.metadata }],
    { ids: [uuid] }
  );
}
