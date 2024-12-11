import {
  BedrockClient,
  GetFoundationModelCommand,
} from "@aws-sdk/client-bedrock";
import { fromInstanceMetadata } from "@aws-sdk/credential-providers";

export async function getFoundationModel(
  region: string,
  modelIdentifier: string
) {
  const client = new BedrockClient({
    region,
    credentials: fromInstanceMetadata({
      maxRetries: 4,
      timeout: 2000,
    }),
  });

  const { modelDetails } = await client.send(
    new GetFoundationModelCommand({ modelIdentifier })
  );

  return modelDetails;
}
