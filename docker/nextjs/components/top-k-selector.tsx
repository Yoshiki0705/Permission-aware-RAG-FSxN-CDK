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

export function TopKSelector() {
  const top_k = useBedrockParams((state) => state.top_k);
  const setTopK = useBedrockParams((state) => state.setTopK);
  return (
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="top-p">Top K</Label>
              <span className="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">
                {top_k}
              </span>
            </div>
            <Slider
              id="top-k"
              max={500}
              defaultValue={top_k}
              step={1}
              onValueChange={setTopK}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              aria-label="Top K"
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          Only sample from the top K options for each subsequent token. Use
          top_k to remove long tail low probability responses.
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
