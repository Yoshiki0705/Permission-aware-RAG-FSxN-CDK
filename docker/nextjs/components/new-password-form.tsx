"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import cookie from "js-cookie";

import { authChanllengeHandler, cn, Icons } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/useAuthStore";
import { AdminRespondToAuthChallengeCommandOutput } from "@aws-sdk/client-cognito-identity-provider";

export type ErrorMessage = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message?: any;
};

export function UserNewPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const router = useRouter();
  const refNewPassword = useRef<HTMLInputElement>(null);
  const refConfirmPassword = useRef<HTMLInputElement>(null);

  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const setIsAuthenticated = useAuthStore((state) => state.setIsAuthenticated);

  const onSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (refNewPassword.current!.value !== refConfirmPassword.current!.value) {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Sign-in error",
        description: "Not match new and confirm password",
      });
      return;
    }
    const newPassword = refNewPassword.current!.value;

    try {
      const response = await authChanllengeHandler({
        username: user!,
        challengeName: "NEW_PASSWORD_REQUIRED",
        newPassword,
        session,
      });

      const data: AdminRespondToAuthChallengeCommandOutput =
        await response!.json();
      console.log(data);
      cookie.set("jwtToken", data.AuthenticationResult!.IdToken!);
      setIsAuthenticated(true);
      setIsLoading(false);
      toast({
        title: "Success",
        description: "Sign-in was successful",
      });
      router.push("/");
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error as ErrorMessage;
      console.log(errorMessage.message);
      toast({
        variant: "destructive",
        title: "Sign-in error",
        description: errorMessage.message,
      });
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      {...props}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Change your password</h1>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email">New Password</Label>
          <Input
            id="new_password"
            placeholder="New password"
            type="password"
            required
            autoCapitalize="none"
            autoCorrect="off"
            disabled={isLoading}
            ref={refNewPassword}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
          </div>
          <Input
            id="confirm_password"
            placeholder="Confirm new password"
            type="password"
            autoCorrect="off"
            required
            disabled={isLoading}
            ref={refConfirmPassword}
          />
        </div>
        <Button disabled={isLoading}>
          {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </div>
    </form>
  );
}
