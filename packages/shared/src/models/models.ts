export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  keyPlaceholder: string;
  keyUrl: string;
  models: ModelDefinition[];
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models",
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        description: "Most capable — best for complex analysis and reasoning",
        recommended: true,
      },
      {
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        description: "Fast and capable — great balance of speed and quality",
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        description: "Fastest — ideal for high-volume, simple tasks",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models",
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      {
        id: "gpt-5.2",
        name: "GPT-5.2",
        description: "Most capable — best for complex analysis and reasoning",
        recommended: true,
      },
      {
        id: "gpt-5-mini",
        name: "GPT-5 Mini",
        description: "Fast and capable — great balance of speed and quality",
      },
      {
        id: "gpt-5.2-pro",
        name: "GPT-5.2 Pro",
        description: "Extended reasoning — for deep research tasks",
      },
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        description: "Previous generation — reliable and well-tested",
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        description: "Budget-friendly — good for simple tasks",
      },
      {
        id: "o4-mini",
        name: "o4-mini",
        description: "Reasoning model — strong at math, code, and logic",
      },
    ],
  },
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getModelsForProvider(providerId: string): ModelDefinition[] {
  return getProvider(providerId)?.models ?? [];
}

export function getDefaultModel(
  providerId: string,
): ModelDefinition | undefined {
  const models = getModelsForProvider(providerId);
  return models.find((m) => m.recommended) ?? models[0];
}
