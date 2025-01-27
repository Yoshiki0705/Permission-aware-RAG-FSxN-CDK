import { ErrorMessage } from "@/components/new-password-form";
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });
  const command = new AdminInitiateAuthCommand({
    AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
    UserPoolId: process.env.USER_POOL_ID,
    ClientId: process.env.USER_POOL_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });
  try {
    const response = await client.send(command);
    return NextResponse.json({ ...response }, { status: 200 });
  } catch (error) {
    const errorContent = error as ErrorMessage;
    return NextResponse.json(
      { message: errorContent.message },
      { status: 500 }
    );
  }
}
