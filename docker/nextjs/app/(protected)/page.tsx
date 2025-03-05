"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/components/chat-message";
import { bedrockResponseHandler } from "@/lib/utils";
import { isEmpty, has } from "lodash-es";
import { useBedrockParams, useMetadataParam } from "@/store/useBedrockParam";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/useAuthStore";

const INIT_MESSAGE = {
  role: "assistant",
  content:
    "Hi! I'm RAG Chatbot. I can help you with queries on your FSxN data.\nWhat would you like to know?",
  documents: [],
};

export default function ChatPage() {
  const user = useAuthStore((state) => state.user);
  const temperature = useBedrockParams((state) => state.temperature);
  const top_p = useBedrockParams((state) => state.top_p);
  const token = useBedrockParams((state) => state.token);
  const modleId = useBedrockParams((state) => state.model);
  const metadata = useMetadataParam((state) => state.metadata);
  const { toast } = useToast();
  const [messages, setMessages] = useState([INIT_MESSAGE]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const currenttMessages = [
      ...messages,
      { role: "user", content: prompt, documents: [] },
      { role: "assistant", content: "", documents: [] },
    ];
    setMessages(currenttMessages);

    setIsLoading(true);

    try {
      const payload = {
        prompt,
        bedrock_model_id: modleId,
        model_kwargs: {
          temperature: temperature[0],
          top_p: top_p[0],
          maxToken: token[0],
        },
        metadata: isEmpty(metadata) ? "NA" : metadata,
        user: user!,
      };

      const response = await bedrockResponseHandler(payload);
      if (!response) return;
      let accumulatedContent = "";
      let currentDocuments: never[] = [];
      const reader = response.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (has(data, "answer")) {
              accumulatedContent += data.answer || "";
            } else if (has(data, "context")) {
              // @ts-expect-error suppress
              console.log(data.context);
              // @ts-expect-error suppress
              currentDocuments = data.context || [];
            }
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                role: "assistant",
                content: accumulatedContent,
                documents: currentDocuments,
              };
              return newMessages;
            });
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Something went wrong.",
        description: "There was a problem with your request.",
      });
    } finally {
      setIsLoading(false);
      setPrompt("");
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}

        <div ref={bottomRef} />
      </main>

      <form onSubmit={handleSubmit} className="sticky bottom- p-4 border-t">
        <div className="max-w-6xl mx-auto">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="w-full text-lg"
          />
        </div>
      </form>
    </div>
  );
}
