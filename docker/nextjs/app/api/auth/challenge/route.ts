import { ErrorMessage } from "@/components/new-password-form";
import {
  CognitoIdentityProviderClient,
  AdminRespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { challengeName, newPassword, username, session } =
    await request.json();
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });

  const command = new AdminRespondToAuthChallengeCommand({
    ClientId: process.env.USER_POOL_CLIENT_ID,
    UserPoolId: process.env.USER_POOL_ID,
    ChallengeName: challengeName,
    ChallengeResponses: {
      USERNAME: username,
      NEW_PASSWORD: newPassword,
    },
    Session: session,
  });
  try {
    const response = await client.send(command);
    console.log(response);
    return NextResponse.json({ ...response }, { status: 200 });
  } catch (error) {
    const errorContent = error as ErrorMessage;
    return NextResponse.json(
      { message: errorContent.message },
      { status: 500 }
    );
  }
}
