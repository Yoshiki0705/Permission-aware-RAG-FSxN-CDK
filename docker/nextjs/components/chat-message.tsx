// components/chat-message.tsx
import { Bot, Smile } from "lucide-react";

import { Card, CardFooter } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Fragment } from "react";

interface ChatMessageProps {
  message: {
    role: string;
    content: string;
    documents: Document[];
  };
}

interface Document {
  metadata: MetaData;
  pageContent: string;
}
interface MetaData {
  source: string;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className="flex items-start space-x-4 mb-4">
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
        {isUser ? (
          <Smile className="h-4 w-4 text-blue-500" />
        ) : (
          <Bot className="h-4 w-4 text-green-500" />
        )}
      </div>
      <Card
        className={`p-4 mb-4 ${message.role === "assistant" ? "w-11/12" : " "}`}
      >
        <div className="p-4 text-lg">
          <div className="prose whitespace-pre-wrap">
            {message.content.split("\n").map((text, index) => (
              <Fragment key={index}>
                {text}
                {index !== message.content.split("\n").length - 1 && <br />}
              </Fragment>
            ))}
          </div>
          {/* <div className="prose whitespace-pre-wrap">{message.content}</div> */}
        </div>

        {message.documents.length > 0 && (
          <CardFooter className="mt-4 pt-4 border-t px-4 rounded-b-lg">
            <Collapsible>
              <CollapsibleTrigger className="text-red-500 hover:text-teal-500 transition-colors text-sm font-medium">
                Sources
              </CollapsibleTrigger>
              <CollapsibleContent>
                {Array.from(new Set(message.documents)).map((data, index) => (
                  <div key={index} className="space-y-1 ">
                    <p className="text-sm font-medium leading-none mt-2 first:mt-0">
                      {data.metadata.source}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      pageContent:{data.pageContent}
                    </p>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
