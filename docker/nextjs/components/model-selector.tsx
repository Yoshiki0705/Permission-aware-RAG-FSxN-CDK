"use client";

import * as React from "react";
import { find } from "lodash-es";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectContent,
  SelectValue,
} from "@/components/ui/select";
import { useBedrockParams } from "@/store/useBedrockParam";
import { models } from "@/data/models";

export function ModelSelector() {
  const model = useBedrockParams((state) => state.model);
  const setModel = useBedrockParams((state) => state.setModel);
  return (
    <div className="grid gap-2">
      <Select
        onValueChange={(e) => setModel(find(models, { name: e })!.id)}
        defaultValue={find(models, { id: model })?.name}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.name}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
