import { ErrorMessage } from "@/components/new-password-form";
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { username, confirmationCode, newPassword } = await request.json();
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });

  const command = new ConfirmForgotPasswordCommand({
    ClientId: process.env.USER_POOL_CLIENT_ID,
    Username: username,
    ConfirmationCode: confirmationCode,
    Password: newPassword,
  });
  try {
    const response = await client.send(command);
    console.log(response);
    return NextResponse.json({ ...response }, { status: 200 });
  } catch (error) {
    console.log(error);
    const errorContent = error as ErrorMessage;
    return NextResponse.json(
      { message: errorContent.message },
      { status: 500 }
    );
  }
}
