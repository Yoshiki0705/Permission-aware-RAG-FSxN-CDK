import { models } from "@/data/models";
import { create } from "zustand";
interface BedrockStoreInterface {
  temperature: number[];
  top_k: number[];
  top_p: number[];
  token: number[];
  model: string;
  setTemp: (temperature: number[]) => void;
  setTopK: (top_k: number[]) => void;
  setTopP: (top_p: number[]) => void;
  setToken: (token: number[]) => void;
  setModel: (model: string) => void;
}

interface MetadataParamInterface {
  metadata: string;
  setMetadata: (sid: string) => void;
}

export const useBedrockParams = create<BedrockStoreInterface>((set) => ({
  temperature: [0],
  top_k: [300],
  top_p: [0.99],
  token: [4096],
  model: models[0].id,
  setTemp: (temperature) => set({ temperature }),
  setTopK: (top_k) => set({ top_k }),
  setTopP: (top_p) => set({ top_p }),
  setToken: (token) => set({ token }),
  setModel: (model) => set({ model }),
}));

export const useMetadataParam = create<MetadataParamInterface>((set) => ({
  metadata: "",
  setMetadata: (metadata: string) => set({ metadata }),
}));
