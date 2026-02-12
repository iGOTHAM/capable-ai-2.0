/**
 * Provider Registry — single source of truth for all LLM provider configurations.
 *
 * Each provider declares its auth methods, env key mapping, models, and whether
 * it's a built-in OpenClaw provider (just needs an env var) or a custom provider
 * (needs a models.providers block in openclaw.json).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthMethod {
  id: "api-key" | "setup-token";
  label: string;
  description: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export interface ProviderDef {
  id: string;
  name: string;
  description: string;
  authMethods: AuthMethod[];
  models: ModelOption[];
  envKey: string;
  /** For setup-token auth, the env var to write (e.g. ANTHROPIC_SETUP_TOKEN) */
  setupTokenEnvKey?: string;
  configType: "builtin" | "custom";
  customProvider?: {
    baseUrl: string;
    api: "openai-completions" | "openai-responses" | "anthropic-messages";
  };
  /** URL for users to get their API key */
  docsUrl?: string;
  /** Placeholder text for the API key input */
  keyPlaceholder?: string;
  /** Base URL for validation (OpenAI-compatible providers) */
  validationBaseUrl?: string;
}

// ─── Auth method presets ────────────────────────────────────────────────────

const API_KEY_AUTH: AuthMethod = {
  id: "api-key",
  label: "API Key",
  description: "Pay per token via API billing",
};

const SETUP_TOKEN_AUTH: AuthMethod = {
  id: "setup-token",
  label: "Use Claude subscription",
  description: "Use your existing Claude Pro/Max plan instead of API billing",
};

// ─── Provider Definitions ───────────────────────────────────────────────────

export const PROVIDERS: ProviderDef[] = [
  // ── Tier 1: Primary providers ──────────────────────────────────────────
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models (recommended)",
    authMethods: [SETUP_TOKEN_AUTH, API_KEY_AUTH],
    envKey: "ANTHROPIC_API_KEY",
    setupTokenEnvKey: "ANTHROPIC_SETUP_TOKEN",
    configType: "builtin",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
    validationBaseUrl: "https://api.anthropic.com",
    models: [
      {
        id: "claude-sonnet-4-5-20250929",
        name: "Claude Sonnet 4.5",
        description:
          "Most intelligent Sonnet — best for coding and complex agents",
        recommended: true,
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        description:
          "Fast and highly capable — great balance of speed and quality",
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        description: "Most powerful model — best for complex reasoning tasks",
      },
      {
        id: "claude-haiku-4-20250414",
        name: "Claude Haiku 4",
        description: "Fastest responses — great for simple tasks and chat",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models",
    authMethods: [API_KEY_AUTH],
    envKey: "OPENAI_API_KEY",
    configType: "builtin",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    validationBaseUrl: "https://api.openai.com/v1",
    models: [
      {
        id: "gpt-5.2",
        name: "GPT-5.2",
        description:
          "Latest flagship — best reasoning, coding, and agentic tasks",
        recommended: true,
      },
      {
        id: "gpt-5-mini",
        name: "GPT-5 Mini",
        description:
          "Powerful small model — great balance of speed and quality",
      },
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        description:
          "Strong coding and instruction following — 1M token context",
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        description: "Fast and affordable — good for most tasks",
      },
      {
        id: "o4-mini",
        name: "o4-mini",
        description:
          "Reasoning model — thinks step-by-step for complex problems",
      },
    ],
  },

  // ── Tier 2: Built-in providers (just need env var) ─────────────────────
  {
    id: "google-gemini",
    name: "Google Gemini",
    description: "Gemini models via Google AI Studio",
    authMethods: [API_KEY_AUTH],
    envKey: "GEMINI_API_KEY",
    configType: "builtin",
    docsUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AI...",
    validationBaseUrl:
      "https://generativelanguage.googleapis.com/v1beta",
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Google's most capable model — strong reasoning and coding",
        recommended: true,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast and efficient — great for most tasks",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Previous generation — fast and reliable",
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 200+ models through one API",
    authMethods: [API_KEY_AUTH],
    envKey: "OPENROUTER_API_KEY",
    configType: "builtin",
    docsUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-...",
    validationBaseUrl: "https://openrouter.ai/api/v1",
    models: [
      {
        id: "anthropic/claude-sonnet-4-5-20250929",
        name: "Claude Sonnet 4.5 (via OpenRouter)",
        description: "Anthropic's best Sonnet — routed through OpenRouter",
        recommended: true,
      },
      {
        id: "openai/gpt-5.2",
        name: "GPT-5.2 (via OpenRouter)",
        description: "OpenAI's flagship — routed through OpenRouter",
      },
      {
        id: "google/gemini-2.5-pro",
        name: "Gemini 2.5 Pro (via OpenRouter)",
        description: "Google's best model — routed through OpenRouter",
      },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    description: "Grok models",
    authMethods: [API_KEY_AUTH],
    envKey: "XAI_API_KEY",
    configType: "builtin",
    docsUrl: "https://console.x.ai",
    keyPlaceholder: "xai-...",
    validationBaseUrl: "https://api.x.ai/v1",
    models: [
      {
        id: "grok-3",
        name: "Grok 3",
        description: "xAI's most capable model — strong reasoning",
        recommended: true,
      },
      {
        id: "grok-3-mini",
        name: "Grok 3 Mini",
        description: "Fast and efficient reasoning model",
      },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast inference with LPU hardware",
    authMethods: [API_KEY_AUTH],
    envKey: "GROQ_API_KEY",
    configType: "builtin",
    docsUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_...",
    validationBaseUrl: "https://api.groq.com/openai/v1",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B",
        description: "Meta's latest open model — fast on Groq hardware",
        recommended: true,
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        description: "Mistral's MoE model — 32K context",
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral AI models",
    authMethods: [API_KEY_AUTH],
    envKey: "MISTRAL_API_KEY",
    configType: "builtin",
    docsUrl: "https://console.mistral.ai/api-keys",
    keyPlaceholder: "...",
    validationBaseUrl: "https://api.mistral.ai/v1",
    models: [
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        description: "Most capable Mistral model — strong reasoning",
        recommended: true,
      },
      {
        id: "mistral-medium-latest",
        name: "Mistral Medium",
        description: "Balanced performance and speed",
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        description: "Fast and cost-effective",
      },
    ],
  },

  // ── Tier 3: Custom providers (need models.providers block) ─────────────
  {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax AI models",
    authMethods: [API_KEY_AUTH],
    envKey: "MINIMAX_API_KEY",
    configType: "custom",
    customProvider: {
      baseUrl: "https://api.minimax.chat/v1",
      api: "openai-completions",
    },
    docsUrl: "https://platform.minimaxi.com",
    keyPlaceholder: "...",
    models: [
      {
        id: "MiniMax-Text-01",
        name: "MiniMax Text 01",
        description: "MiniMax's flagship text model",
        recommended: true,
      },
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    description: "Kimi / Moonshot models",
    authMethods: [API_KEY_AUTH],
    envKey: "MOONSHOT_API_KEY",
    configType: "custom",
    customProvider: {
      baseUrl: "https://api.moonshot.cn/v1",
      api: "openai-completions",
    },
    docsUrl: "https://platform.moonshot.cn",
    keyPlaceholder: "sk-...",
    models: [
      {
        id: "moonshot-v1-128k",
        name: "Moonshot v1 128K",
        description: "128K context — strong multilingual model",
        recommended: true,
      },
      {
        id: "moonshot-v1-32k",
        name: "Moonshot v1 32K",
        description: "32K context — faster and more efficient",
      },
    ],
  },
  {
    id: "zai",
    name: "Z.AI",
    description: "GLM-4 models from Zhipu AI",
    authMethods: [API_KEY_AUTH],
    envKey: "ZAI_API_KEY",
    configType: "custom",
    customProvider: {
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      api: "openai-completions",
    },
    docsUrl: "https://open.bigmodel.cn",
    keyPlaceholder: "...",
    models: [
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        description: "Latest GLM model — strong Chinese and English",
        recommended: true,
      },
      {
        id: "glm-4",
        name: "GLM-4",
        description: "Capable multilingual model",
      },
    ],
  },
  {
    id: "venice",
    name: "Venice AI",
    description: "Privacy-focused AI models",
    authMethods: [API_KEY_AUTH],
    envKey: "VENICE_API_KEY",
    configType: "custom",
    customProvider: {
      baseUrl: "https://api.venice.ai/api/v1",
      api: "openai-completions",
    },
    docsUrl: "https://venice.ai",
    keyPlaceholder: "...",
    models: [
      {
        id: "llama-3.3-70b",
        name: "Llama 3.3 70B",
        description: "Open model — private and uncensored inference",
        recommended: true,
      },
    ],
  },
];

// ─── Lookup Helpers ─────────────────────────────────────────────────────────

/** Get a provider definition by ID. Returns undefined if not found. */
export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Get all known env keys across all providers (for detecting current provider). */
export function getAllEnvKeys(): string[] {
  const keys: string[] = [];
  for (const p of PROVIDERS) {
    keys.push(p.envKey);
    if (p.setupTokenEnvKey) keys.push(p.setupTokenEnvKey);
  }
  return keys;
}

/** Detect which provider is currently configured by checking env vars. */
export function detectProviderFromEnv(
  env: Record<string, string>,
): ProviderDef | undefined {
  for (const p of PROVIDERS) {
    if (env[p.envKey]) return p;
    if (p.setupTokenEnvKey && env[p.setupTokenEnvKey]) return p;
  }
  return undefined;
}
