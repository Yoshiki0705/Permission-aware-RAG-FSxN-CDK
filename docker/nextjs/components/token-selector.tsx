"use client";

import * as React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useBedrockParams } from "@/store/useBedrockParam";

export function TokenSelector() {
  const token = useBedrockParams((state) => state.token);
  const setToken = useBedrockParams((state) => state.setToken);
  return (
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="top-p">MaxToken</Label>
              <span className="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">
                {token}
              </span>
            </div>
            <Slider
              id="max-token"
              max={4096}
              defaultValue={token}
              step={1}
              onValueChange={setToken}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              aria-label="Max Token"
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          The maximum number of tokens to generate before stopping. Note that
          Anthropic Claude models might stop generating tokens before reaching
          the value of max_tokens. Different Anthropic Claude models have
          different maximum values for this parameter.
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
