import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ModelKwargs {
  temperature: number;
  top_k: number;
  top_p: number;
  maxToken: number;
}
interface Payload {
  model_kwargs: ModelKwargs;
  metadata: string;
  prompt: string;
  bedrock_model_id: string;
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const bedrockResponseHandler = async (payload: Payload) => {
  console.log("utils");
  console.log(payload);
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
