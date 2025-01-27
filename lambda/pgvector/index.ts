/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import {
  CdkCustomResourceEvent,
  CdkCustomResourceResponse,
  Context,
  Handler,
} from "aws-lambda";

import {
  RDSDataClient,
  ExecuteStatementCommand,
} from "@aws-sdk/client-rds-data";

export const handler: Handler = async (
  event: CdkCustomResourceEvent,
  context: Context
) => {
  const client = new RDSDataClient({
    region: process.env.AWS_REGION,
  });

  const response: CdkCustomResourceResponse = {
    PhysicalResourceId: event.StackId,
  };

  const baseCommand = {
    resourceArn: process.env.RDS_ARN,
    secretArn: process.env.RDS_SECRET_ARN,
  };
  const vectorExtension = new ExecuteStatementCommand({
    ...baseCommand,
    sql: "CREATE EXTENSION IF NOT EXISTS vector",
  });
  const uuidExtension = new ExecuteStatementCommand({
    ...baseCommand,
    sql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
  });

  const createDocument = new ExecuteStatementCommand({
    ...baseCommand,
    sql: "CREATE TABLE IF NOT EXISTS documents (id uuid PRIMARY KEY, content TEXT, metadata JSONB, embedding vector(1024))",
  });
  const createIndex = new ExecuteStatementCommand({
    ...baseCommand,
    sql: "CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)",
  });

  try {
    await client.send(vectorExtension);
    await client.send(uuidExtension);
    await client.send(createDocument);
    await client.send(createIndex);
    response.Status = "SUCCESS";
    return response;
  } catch (error) {
    console.log(error);
    response.Status = "FAILED";
    return response;
  }
};
