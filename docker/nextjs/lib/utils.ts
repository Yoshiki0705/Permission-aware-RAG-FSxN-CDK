import { clsx, type ClassValue } from "clsx";
import { Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface ModelKwargs {
  temperature: number;
  top_p: number;
  maxToken: number;
}
interface Payload {
  model_kwargs: ModelKwargs;
  metadata: string;
  prompt: string;
  bedrock_model_id: string;
  user: string;
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Icons = {
  spinner: Loader2,
};

export const bedrockResponseHandler = async (payload: Payload) => {
  // console.log(payload);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.body;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};
export const signInHandler = async (payload: {
  username: string;
  password: string;
}) => {
  try {
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    // const response = {
    //   AuthenticationResult: {
    //     IdToken: "hogehoge",
    //   },
    // };
    console.log(response);
    return response;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      throw new Error(error.message);
    }
  }
};

export const authChanllengeHandler = async (payload: {
  challengeName: string;
  username: string;
  newPassword: string;
  session: string;
}) => {
  try {
    const response = await fetch("/api/auth/challenge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      console.log("util json", error);
      throw new Error(error.message);
    }
    return response;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      throw new Error(error.message);
    }
  }
};

export const resetPasswordHandler = async (payload: { username: string }) => {
  try {
    console.log("reset");
    const response = await fetch("/api/auth/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    return response;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      throw new Error(error.message);
    }
  }
};

export const confirmationForgotPasswordHandler = async (payload: {
  username: string;
  confirmationCode: string;
  newPassword: string;
}) => {
  try {
    const response = await fetch("/api/auth/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      console.log("util json", error);
      throw new Error(error.message);
    }
    return response;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      throw new Error(error.message);
    }
  }
};

export const signOutHandler = async (payload: { username: string }) => {
  try {
    const response = await fetch("api/auth/signout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    return response;
  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message);
      throw new Error(error.message);
    }
  }
};
