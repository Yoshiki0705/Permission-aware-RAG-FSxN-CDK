"use client";

import { useRef, useState } from "react";
import cookie from "js-cookie";
import { useRouter } from "next/navigation";

import { ErrorMessage } from "@/components/new-password-form";
import { Button } from "@/components/ui/button";
import {
  confirmationForgotPasswordHandler,
  Icons,
  resetPasswordHandler,
} from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmForgotPasswordCommandOutput } from "@aws-sdk/client-cognito-identity-provider";
import { SignInImage } from "@/components/signin-image";

export default function ResetPasswordPage() {
  const [isRecoveryOpen, setIsRecoveryOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const refUser = useRef<HTMLInputElement>(null);
  const refCode = useRef<HTMLInputElement>(null);
  const refNewPassword = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { toast } = useToast();

  const onSubmitReset = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    const username = refUser.current!.value;
    console.log(username);
    try {
      setIsLoading(false);
      await resetPasswordHandler({ username });
      setIsRecoveryOpen(!isRecoveryOpen);
    } catch (error) {
      console.log(error);
      setIsLoading(false);
      const errorMessage = error as ErrorMessage;
      toast({
        variant: "destructive",
        title: "Failed to reset password",
        description: errorMessage.message,
      });
    }
  };

  const onSubmitRecovery = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    const username = refUser.current!.value;
    const confirmationCode = refCode.current!.value;
    const newPassword = refNewPassword.current!.value;
    try {
      const response = await confirmationForgotPasswordHandler({
        username,
        confirmationCode,
        newPassword,
      });
      const data: ConfirmForgotPasswordCommandOutput = await response!.json();
      cookie.set("jwtToken", data.$metadata!.requestId!);
      setIsRecoveryOpen(!isRecoveryOpen);
      setIsLoading(false);
      router.push("/");
      toast({
        title: "Reset password successfully",
        description: "Try to sign in with your new password",
      });
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error as ErrorMessage;
      toast({
        variant: "destructive",
        title: "Failed to reset password",
        description: errorMessage.message,
      });
    }
  };
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {!isRecoveryOpen ? (
              <form className="flex flex-col gap-6" onSubmit={onSubmitReset}>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Reset password</h1>
                </div>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="username"
                      type="text"
                      required={true}
                      disabled={isLoading}
                      ref={refUser}
                    />
                  </div>
                  <Button disabled={isLoading}>
                    {isLoading && (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit
                  </Button>
                </div>
              </form>
            ) : (
              <form className="flex flex-col gap-6" onSubmit={onSubmitRecovery}>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Reset password</h1>
                </div>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="username"
                      type="text"
                      required={true}
                      disabled={isLoading}
                      ref={refUser}
                    />
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      placeholder="Your code from your email"
                      type="code"
                      required={true}
                      autoCapitalize="none"
                      autoCorrect="off"
                      disabled={isLoading}
                      ref={refCode}
                    />
                    <Label htmlFor="new_password">New password</Label>
                    <Input
                      id="new_password"
                      placeholder="Your new password"
                      type="password"
                      autoCorrect="off"
                      required={true}
                      disabled={isLoading}
                      ref={refNewPassword}
                    />
                  </div>
                  <Button disabled={isLoading}>
                    {isLoading && (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <SignInImage />
    </div>
  );
}
