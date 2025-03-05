export interface Model {
  id: string;
  name: string;
}

export const models: Model[] = [
  {
    id: "amazon.nova-pro-v1:0",
    name: "Amazon Nova Pro",
  },
  {
    id: "amazon.nova-lite-v1:0",
    name: "Amazon Nova Lite",
  },
  {
    id: "amazon.nova-micro-v1:0",
    name: "Amazon Nova Mirco",
  },
  // {
  //   id: "anthropic.claude-3-5-sonnet-20240620-v1:0",
  //   name: "Claude 3.5 Sonnet",
  // },
  // {
  //   id: "anthropic.claude-3-haiku-20240307-v1:0",
  //   name: "Claude 3 Hiku",
  // },
  // {
  //   id: "anthropic.claude-3-sonnet-20240229-v1:0",
  //   name: "Claude 3 Sonnet",
  // },
  // {
  //   id: "anthropic.claude-v2:1",
  //   name: "Claude 2",
  // },
];
