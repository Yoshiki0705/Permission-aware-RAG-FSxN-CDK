import { NextResponse } from "next/server";
import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { BedrockEmbeddings } from "@langchain/aws";
import { OpenSearchVectorStore } from "@langchain/community/vectorstores/opensearch";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { DynamoDBChatMessageHistory } from "@langchain/community/stores/message/dynamodb";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ModelKwargs } from "@/lib/utils";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { retrievalChain, messageHistory } = await initConversationChain(
      body.bedrock_model_id,
      body.model_kwargs,
      body.metadata
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
  metadata: string
) {
  const host = process.env.AOSS_HOST;
  const region = process.env.AWS_REGION!;
  const collectionName = process.env.COLLECTION_NAME;
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
  const embeddings = new BedrockEmbeddings({
    region: "us-east-1",
    model: "amazon.titan-embed-text-v2:0",
  });

  const vectorStore = new OpenSearchVectorStore(embeddings, {
    client: opensearchClient,
    service: "aoss",
    indexName: `${collectionName}-index`,
    vectorFieldName: "vector_field",
    textFieldName: "text",
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
    tableName: "SessionTable",
    partitionKey: "SessionId",
    sessionId: "12345",
  });

  if (
    region !== "us-east-1" &&
    bedrock_model_id === "anthropic.claude-3-sonnet-20240229-v1:0"
  ) {
    bedrock_model_id = "apac.anthropic.claude-3-sonnet-20240229-v1:0";
  }
  const llm = new BedrockChat({
    model: bedrock_model_id,
    region: region,
    temperature: model_kwargs.temperature,
    maxTokens: model_kwargs.maxToken,
    modelKwargs: {
      top_p: model_kwargs.top_p,
      top_k: model_kwargs.top_k,
    },
    streaming: true,
  });

  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt: qaPrompt,
  });

  const everyoneAcl = "S-1-1-0";
  let retriever;
  if (metadata === "NA") {
    retriever = vectorStore.asRetriever({
      filter: {
        "acl.allowed": everyoneAcl,
      },
      verbose: true,
    });
  } else {
    retriever = vectorStore.asRetriever({
      filter: {
        "acl.allowed": metadata,
      },
    });
  }

  const retrievalChain = await createRetrievalChain({
    combineDocsChain: documentChain,
    retriever,
  });
  return { messageHistory, retrievalChain };
}
