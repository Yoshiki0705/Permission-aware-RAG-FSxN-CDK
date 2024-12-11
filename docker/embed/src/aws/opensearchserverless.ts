import {
  OpenSearchServerlessClient,
  BatchGetCollectionCommand,
  CollectionSummary,
  paginateListCollections,
} from "@aws-sdk/client-opensearchserverless";
import { fromInstanceMetadata } from "@aws-sdk/credential-providers";
export async function getCollection(region: string, name: string) {
  const client = getClient(region);

  const { collectionDetails = [] } = await client.send(
    new BatchGetCollectionCommand({ names: [name] })
  );

  if (collectionDetails.length === 0) {
    throw new Error(`Collection ${name} is not found in region ${region}`);
  } else {
    return collectionDetails[0];
  }
}

export async function listCollections(region: string) {
  const client = await getClient(region);

  const paginator = paginateListCollections({ client }, {});

  const collections: CollectionSummary[] = [];
  for await (const { collectionSummaries = [] } of paginator) {
    collections.push(...collectionSummaries);
  }

  return collections;
}

function getClient(region: string) {
  return new OpenSearchServerlessClient({
    region,
    credentials: fromInstanceMetadata({
      maxRetries: 4,
      timeout: 2000,
    }),
  });
}
