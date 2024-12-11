export interface Model {
  id: string;
  name: string;
}

export const models: Model[] = [
  {
    id: "anthropic.claude-3-haiku-20240307-v1:0",
    name: "Claude 3 Hiku",
  },
  {
    id: "anthropic.claude-3-sonnet-20240229-v1:0",
    name: "Claude 3 Sonnet",
  },
  {
    id: "anthropic.claude-v2:1",
    name: "Claude 2",
  },
];
