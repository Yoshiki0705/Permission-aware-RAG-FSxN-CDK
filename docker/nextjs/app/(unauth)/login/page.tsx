"use client";

import { useEffect } from "react";
import cookie from "js-cookie";
import { LoginForm } from "@/components/login-form";
import { UserNewPasswordForm } from "@/components/new-password-form";
import { useAuthStore } from "@/store/useAuthStore";
import { SignInImage } from "@/components/signin-image";
export default function LoginPage() {
  const signInStep = useAuthStore((state) => state.signInStep);
  const getState = useAuthStore.getState();
  if (cookie.get("jwtToken")) {
    cookie.remove("jwtToken");
  }
  useEffect(() => {}, [getState]);
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {signInStep !== "NEW_PASSWORD_REQUIRED" ? (
              <LoginForm />
            ) : (
              <UserNewPasswordForm />
            )}
          </div>
        </div>
      </div>
      <SignInImage />
    </div>
  );
}
