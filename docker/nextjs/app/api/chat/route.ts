import { NextResponse } from "next/server";
import { BedrockEmbeddings, ChatBedrockConverse } from "@langchain/aws";
import { OpenSearchVectorStore } from "@langchain/community/vectorstores/opensearch";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import {
  DistanceStrategy,
  PGVectorStore,
  PGVectorStoreArgs,
} from "@langchain/community/vectorstores/pgvector";
import { PoolConfig } from "pg";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { DynamoDBChatMessageHistory } from "@langchain/community/stores/message/dynamodb";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

import { ModelKwargs } from "@/lib/utils";

interface DBSecrets {
  dbClusterIdentifier: string;
  password: string;
  engine: string;
  port: number;
  host: string;
  username: string;
}

interface Item {
  SID: string[];
  userId: string[];
  member: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { retrievalChain, messageHistory } = await initConversationChain(
      body.bedrock_model_id,
      body.model_kwargs,
      body.metadata,
      body.user
    );
    const chatHistory = await messageHistory.getMessages();
    const response = await retrievalChain.stream({
      input: body.prompt,
      chat_history: chatHistory,
    });

    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of response) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`)
            );
          }
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

async function initConversationChain(
  bedrock_model_id: string,
  model_kwargs: ModelKwargs,
  metadata: string,
  user: string
) {
  const region = process.env.AWS_REGION!;
  if (region.startsWith("us")) {
    bedrock_model_id = "us." + bedrock_model_id;
  }

  if (region.startsWith("ap")) {
    bedrock_model_id = "apac." + bedrock_model_id;
  }

  const embeddings = new BedrockEmbeddings({
    region: "us-east-1",
    model: "amazon.titan-embed-text-v2:0",
  });

  const qaPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `This is a friendly conversation between a human and an AI.
    The AI is talkative and provides specific details from its context but limits it to 240 tokens.
    If the AI does not know the answer to a question, it truthfully says it does not know.`,
    ],
    new MessagesPlaceholder("chat_history"),
    [
      "human",
      `Here are a few documents in <documents> tags:
    <documents>
    {context}
    </documents>
    Based on the above documents, provide a detailed answer for, {input}`,
    ],
  ]);

  const messageHistory = new DynamoDBChatMessageHistory({
    tableName: process.env.TABLE_NAME!,
    partitionKey: "SessionId",
    sessionId: "12345",
  });

  const llm = new ChatBedrockConverse({
    model: bedrock_model_id,
    region: region,
    temperature: model_kwargs.temperature,
    maxTokens: model_kwargs.maxToken,
    topP: model_kwargs.top_p,
    streaming: true,
  });

  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt: qaPrompt,
  });

  let userAcl: string[] = ["S-1-1-0"];

  if (metadata !== "NA") {
    userAcl.push(metadata);
  }
  if (process.env.USER_ACCESS_TABLE_NAME) {
    const item = await getUserInfo(region, user);
    if (item.member) {
      userAcl = [...userAcl, ...item.SID];
    }
  }

  let retriever;
  if (process.env.COLLECTION_NAME) {
    const host = process.env.VECTOR_HOST!;
    const collectionName = process.env.COLLECTION_NAME!;
    const opensearchClient = new Client({
      ...AwsSigv4Signer({
        region,
        service: "aoss",
      }),
      node: host,
      ssl: {
        rejectUnauthorized: true,
      },
    });
    const openSearchVectorStore = new OpenSearchVectorStore(embeddings, {
      client: opensearchClient,
      service: "aoss",
      indexName: `${collectionName}-index`,
      vectorFieldName: "vector_field",
      textFieldName: "text",
    });

    retriever = openSearchVectorStore.asRetriever({
      filter: {
        acl: userAcl,
      },
      verbose: true,
    });
  } else {
    const secretValue = await getSecretValue(region, process.env.SECRETS_ARN!);
    const secrets: DBSecrets = JSON.parse(secretValue as string);
    const hnswConfig: PGVectorStoreArgs = {
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

    retriever = hnswPgVectorStore.asRetriever({
      filter: {
        acl: {
          arrayContains: userAcl,
        },
      },
      verbose: true,
    });
  }

  const retrievalChain = await createRetrievalChain({
    combineDocsChain: documentChain,
    retriever,
  });
  return { messageHistory, retrievalChain };
}

async function getSecretValue(region: string, secretName: string) {
  const client = new SecretsManagerClient({
    region,
  });

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
    return response.SecretString;
  } catch (error) {
    console.error("Get Secrets value error:", error);
    throw error;
  }
}

async function getUserInfo(region: string, userId: string) {
  const client = new DynamoDBClient({
    region,
  });
  const docClient = DynamoDBDocumentClient.from(client);
  const command = new GetCommand({
    TableName: process.env.USER_ACCESS_TABLE_NAME,
    Key: {
      userId,
    },
  });

  try {
    const response = await docClient.send(command);
    console.log(response.Item);
    return response.Item as Item;
  } catch (error) {
    console.error("Get UserInfo error:", error);
    throw error;
  }
}
