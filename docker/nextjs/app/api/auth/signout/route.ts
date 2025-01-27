import { ErrorMessage } from "@/components/new-password-form";
import {
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProvider,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { username } = await request.json();
  console.log(username);
  const client = new CognitoIdentityProvider({
    region: process.env.AWS_REGION,
  });
  const command = new AdminUserGlobalSignOutCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
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
