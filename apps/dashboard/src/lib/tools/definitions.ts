/**
 * Tool definitions for the agentic chat loop.
 * Provides schemas in both OpenAI and Anthropic formats.
 */

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: "web_search",
    description:
      "Search the web using DuckDuckGo. Returns a list of results with titles, URLs, and snippets. Use this to find current information, answer factual questions, or research topics.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description:
      "Fetch the content of a web page and return it as plain text (HTML tags stripped). Use this to read articles, documentation, or any web page the user asks about.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
      },
      required: ["url"],
    },
  },
];

/** OpenAI function-calling format */
export function getOpenAITools() {
  return TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** Anthropic tool-use format */
export function getAnthropicTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}
