"use client";

import { useRouter } from "next/navigation";
import cookie from "js-cookie";

import { cn, Icons, signInHandler } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import { useRef, useState } from "react";
import { ErrorMessage } from "./new-password-form";
import { useAuthStore } from "@/store/useAuthStore";
import { AdminInitiateAuthCommandOutput } from "@aws-sdk/client-cognito-identity-provider";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const refUser = useRef<HTMLInputElement>(null);
  const refPassword = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const router = useRouter();

  const setUser = useAuthStore((state) => state.setUser);
  const setSession = useAuthStore((state) => state.setSession);
  const setSignInStep = useAuthStore((state) => state.setSignInStep);

  const onSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    const username = refUser.current!.value;
    const password = refPassword.current!.value;
    try {
      const response = await signInHandler({
        username,
        password,
      });
      // const data: AdminInitiateAuthCommandOutput = response!;
      const data: AdminInitiateAuthCommandOutput = await response!.json();
      console.log(data);
      if (
        data.ChallengeName &&
        data.ChallengeName === "NEW_PASSWORD_REQUIRED"
      ) {
        setUser(data.ChallengeParameters!.USER_ID_FOR_SRP);
        setSession(data.Session!);
        setSignInStep(data.ChallengeName);
      } else {
        cookie.set("jwtToken", data.AuthenticationResult!.IdToken!);
        setIsLoading(false);
        setUser(username);
        toast({
          title: "Success",
          description: "Sign-in was successful",
        });
        router.push("/");
      }
    } catch (error) {
      const errorMessage = error as ErrorMessage;
      toast({
        variant: "destructive",
        title: "Sign-in error",
        description: errorMessage.message,
      });
      setIsLoading(false);
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      {...props}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">
          RAG Application with NetApp ONTAP
        </h1>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="user01"
            required
            ref={refUser}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input id="password" type="password" required ref={refPassword} />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-background px-2 text-muted-foreground">
            Or forgot password with
          </span>
        </div>
        <Button
          variant="outline"
          type="button"
          disabled={isLoading}
          onClick={() => router.push("/reset")}
        >
          Reset your password
        </Button>
      </div>
    </form>
  );
}
