import "dotenv/config";
import { scheduler } from "node:timers/promises";
import { setInterval } from "node:timers";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import ms from "ms";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BedrockEmbeddings } from "@langchain/aws";
import { Client } from "@opensearch-project/opensearch";
import pMap from "p-map";
import { listCollections } from "./aws/opensearchserverless";
import {
  bulkDelete,
  createIndex,
  getClient,
  indexDocument,
  bulkUpdate,
} from "./opensearch";
import { validate } from "./validator";
import { scan } from "./scanner";
import {
  deleteFileById,
  deleteFilesByNotScanId,
  findFileById,
  findFileByIno,
  findFilesByNotScanId,
  insertDocuments,
  insertFile,
  updateFileScanIdById,
  updateFileCtimeById,
} from "./compare/operations";
import { Document } from "langchain/document";
import { DefaultMetadata, FileMetadata } from "./types/metadata";
import { fromInstanceMetadata } from "@aws-sdk/credential-providers";
import { addIndexDocument, batchDelete, batchUpdate } from "./aws/pgvector";

async function main() {
  console.log("Starting...");

  // use external region if provided
  if (process.env.ENV_REGION) {
    process.env.REGION = process.env.ENV_REGION;
  }

  const { SCANNER_INTERVAL } = process.env;

  if (process.env.ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME) {
    process.env.OPEN_SEARCH_SERVERLESS_COLLECTION_NAME =
      process.env.ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME;

    const { REGION, OPEN_SEARCH_SERVERLESS_COLLECTION_NAME } = process.env;
    console.log(
      `Operating in region ${REGION}, collection name ${OPEN_SEARCH_SERVERLESS_COLLECTION_NAME}`
    );
    //
    // Validate provided configuration
    //
    await validate();

    //
    // Reuse collection if it is already exists, create collection and index otherwise
    //
    let client: Client;
    const indexName = `${OPEN_SEARCH_SERVERLESS_COLLECTION_NAME}-index`;

    const collections = await listCollections(REGION);
    const collection = collections.find(
      ({ name }) => name === OPEN_SEARCH_SERVERLESS_COLLECTION_NAME
    );

    if (collection) {
      console.log(
        `Collection ${OPEN_SEARCH_SERVERLESS_COLLECTION_NAME} already exists`
      );
      client = getClient(
        REGION,
        `https://${collection.id}.${REGION}.aoss.amazonaws.com`
      );

      // check if index exists
      const { body } = await client.indices.exists({ index: indexName });
      if (body) {
        console.log(`Index ${indexName} exists`);
      } else {
        console.log(`Index ${indexName} does not exist - creating`);
        await createIndex(client, indexName);

        // wait until the configuration propagates
        await scheduler.wait(10000);
      }
    } else {
      // we already validated collection existence in validation stage
      process.exit(-1);
    }

    // process immediately after start
    await processFiles(client, REGION, indexName);

    // prevent overlapping scan cycles
    let isActive = false;
    // process periodically
    setInterval(async () => {
      if (isActive) {
        console.log("Skipping scanning cycle - previous cycle is still active");
        return;
      }

      isActive = true;
      await processFiles(client, REGION, indexName), ms(SCANNER_INTERVAL);
      isActive = false;
    }, ms(SCANNER_INTERVAL));
  } else {
    // Validate provided configuration
    //
    const { REGION } = process.env;

    await validate();
    let client: Client;
    // process immediately after start
    await processFiles(client, REGION);

    // prevent overlapping scan cycles
    let isActive = false;
    // process periodically
    setInterval(async () => {
      if (isActive) {
        console.log("Skipping scanning cycle - previous cycle is still active");
        return;
      }

      isActive = true;
      await processFiles(client, REGION), ms(SCANNER_INTERVAL);
      isActive = false;
    }, ms(SCANNER_INTERVAL));
  }
}

async function processFiles(
  client: Client,
  region?: string,
  indexName?: string
) {
  const {
    // REGION,
    BEDROCK_EMBEDDING_MODEL_ID,
    DATA_DIRECTORY,
    FILES_PROCESSING_CONCURRENCY,
    DOCUMENTS_INDEXING_CONCURRENCY,
    EMBEDDING_CONCURRENCY,
  } = process.env;

  //
  // for each ino
  // check if it was changed based by mtimeMs
  // if not changed -> update scan id
  // if changed -> delete, embed, add
  // once completed interacting over all ino -> delete all items with non current scan id
  //
  const files = await scan(DATA_DIRECTORY);

  const scanId = randomUUID();
  console.log("Current scan id", scanId);

  const bedrockEmbeddings = new BedrockEmbeddings({
    region: "us-east-1",
    model: BEDROCK_EMBEDDING_MODEL_ID,
    credentials: fromInstanceMetadata({
      maxRetries: 4,
      timeout: 2000,
    }),
  });

  await pMap(
    files,
    async (file, index) => {
      const { path, ino, mtimeMs, ctimeMs, acl } = file;
      console.log(`Handling file ${index + 1} out of ${files.length}`, {
        path,
        ino,
      });

      const fileSnapshot = await findFileByIno(ino);
      if (fileSnapshot) {
        if (fileSnapshot.mtimeMs === mtimeMs) {
          console.log("Existing file - no changes", { path, ino });

          if (fileSnapshot.ctimeMs !== ctimeMs) {
            console.log(`File attributes changed -> updating ACL`);
            const file = await findFileById(fileSnapshot.id);
            if (file) {
              const ids = file.documents.map(({ opensearchId }) => ({
                id: opensearchId,
              }));
              if (indexName) {
                // perform partial update - update ACL field of existing document
                await bulkUpdate(client, indexName!, ids, {
                  metadata: {
                    acl,
                  },
                });
              } else {
                await batchUpdate(ids, acl as string[], region!);
              }

              // update ctime in internal db
              await updateFileCtimeById(fileSnapshot.id, ctimeMs);
            }
          }

          await updateFileScanIdById(fileSnapshot.id, scanId);
          return;
        } else {
          console.log("Existing file - with changes", { path, ino });

          const file = await findFileById(fileSnapshot.id);
          if (file) {
            const ids = file.documents.map(({ opensearchId }) => opensearchId);
            console.log(
              `Bulk deleting ${ids.length} documents from opensearch, file`,
              { path, ino }
            );
            if (indexName) {
              await bulkDelete(client, indexName!, ids);
            } else {
              await batchDelete(ids, region);
            }

            console.log(`Deleting file ${fileSnapshot.id} from internal db`);
            await deleteFileById(fileSnapshot.id);
            console.log(`Processing file ${path}, ino ${ino} as if it was new`);
          } else {
            throw new Error(`Failed to find file by id ${fileSnapshot.id}`);
          }
        }
      } else {
        console.log("New file", { path, ino });
      }

      const documents = await toDocuments(path);
      if (!documents) {
        return;
      }

      console.log(`File ${path} converted to ${documents.length} documents`);

      //
      // Manage embedding concurrency in order to avoid throttling
      // This should be changed once batching is supported for AWS SDK for JavaScript v3
      // https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html
      //

      const vectors = (
        await pMap(
          documents,
          async ({ pageContent }, idx) => {
            if (idx % 100 === 0) {
              console.log(
                `Embedding document ${idx + 1} out of ${documents.length}`
              );
            }

            const vector = await bedrockEmbeddings.embedDocuments([
              pageContent,
            ]);
            return vector;
          },
          {
            concurrency: parseInt(EMBEDDING_CONCURRENCY),
          }
        )
      ).flat();

      console.log(
        `${vectors.length} vectors created for file ${path} and ino ${ino}`
      );

      const ids = await pMap(
        documents,
        async ({ metadata, pageContent }, idx) => {
          // OpenSearch serverless does not support providing _id while indexing
          // Langchain uses bulk index operation which does not return ids generated by OpenSearch
          // we have to index documents one by one
          if (indexName) {
            const { _id } = await indexDocument(client, indexName!, {
              metadata: merge(metadata, file),
              text: pageContent,
              vector_field: vectors[idx],
            });
            return _id;
          } else {
            // Aurora processing
            const uuid = randomUUID();
            await addIndexDocument(
              {
                metadata: merge(metadata, file),
                text: pageContent,
                vector_field: vectors[idx],
              },
              bedrockEmbeddings,
              process.env.REGION,
              uuid
            );
            return uuid;
          }
        },
        { concurrency: parseInt(DOCUMENTS_INDEXING_CONCURRENCY) }
      );

      console.log(`${ids.length} documents persisted in vector store`);
      //
      // update internal DB
      // it holds information about files and documents
      // connects between periodic file system scanner and opensearch
      //
      const [{ fileId }] = await insertFile(ino, mtimeMs, ctimeMs, scanId);
      console.log(`File ino ${ino} persisted in internal db with id ${fileId}`);
      await insertDocuments(fileId, ids);
      console.log(
        `${ids.length} documents of file id ${fileId} persisted in internal db`
      );
    },
    { concurrency: parseInt(FILES_PROCESSING_CONCURRENCY) }
  );

  if (indexName) {
    console.log("opensearch cleanup");
    await cleanup(scanId, indexName!, client!);
  } else {
    console.log("aurora cleanup");
    await cleanup(scanId);
  }
}

function merge(documentMetadata: DefaultMetadata, fileMetadata: FileMetadata) {
  // merge metadata created by langchain (loc, source) with POSIX and ACL
  const { mtimeMs, size, acl } = fileMetadata;
  const { loc, source } = documentMetadata;

  return { ...{ source, loc }, ...{ mtimeMs, size, acl } };
}

async function toDocuments(path: string) {
  try {
    const loader = load(path);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: parseInt(process.env.TEXT_SPLITTER_CHUNK_SIZE),
      chunkOverlap: parseInt(process.env.TEXT_SPLITTER_CHUNK_OVERLAP),
    });

    const documents = await splitter.splitDocuments(await loader.load());

    // langchain type system does not allow document metadata type configuration now
    return documents as Document<DefaultMetadata>[];
  } catch (err) {
    console.warn(`Failed to convert path ${path} to documents`, err);
  }
}

function load(path: string) {
  switch (extname(path)) {
    case ".pdf":
      return new PDFLoader(path, { splitPages: true });
    case ".csv":
      return new CSVLoader(path);
    case ".txt":
      return new TextLoader(path);
    default:
      throw new Error(`Got unsupported file type ${extname(path)}`);
  }
}

async function cleanup(scanId: string, indexName?: string, client?: Client) {
  console.log("Cleanup stage");
  // find files with scan id different then the current one
  const files = await findFilesByNotScanId(scanId);
  if (files.length === 0) {
    console.log("No deleted files identified");
  } else {
    console.log(
      "Deleting files",
      files.map(({ ino }) => ino)
    );

    // delete documents form opensearch
    const ids = files
      .map(({ documents }) => documents.map(({ opensearchId }) => opensearchId))
      .flat();
    console.log(`Deleting ${ids.length} documents from vector store`);
    if (indexName) {
      console.log("openseach bulkDelete");
      await bulkDelete(client, indexName, ids);
    } else {
      console.log("aurora batchDelete");
      await batchDelete(ids, process.env.ENV_REGION);
    }

    // delete files and documents from the internal db
    await deleteFilesByNotScanId(scanId);
    console.log(
      `Files and documents with scan id different then ${scanId} were removed from internal db`
    );
  }
}

main();
