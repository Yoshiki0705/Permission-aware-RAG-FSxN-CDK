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

export function TopPSelector() {
  const top_p = useBedrockParams((state) => state.top_p);
  const setTopP = useBedrockParams((state) => state.setTopP);

  return (
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="top-p">Top P</Label>
              <span className="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">
                {top_p}
              </span>
            </div>
            <Slider
              id="top-p"
              max={1}
              defaultValue={top_p}
              step={0.1}
              onValueChange={setTopP}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              aria-label="Top P"
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          Use nucleus sampling. In nucleus sampling, Anthropic Claude computes
          the cumulative distribution over all the options for each subsequent
          token in decreasing probability order and cuts it off once it reaches
          a particular probability specified by top_p. You should alter either
          temperature or top_p, but not both.
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
