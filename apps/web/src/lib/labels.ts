/** Human-readable labels for template IDs */
export const TEMPLATE_LABELS: Record<string, string> = {
  pe: "Private Equity",
  legal: "Legal",
  healthcare: "Healthcare",
  general: "General",
};

/** Human-readable labels for mode enums */
export const MODE_LABELS: Record<string, string> = {
  DRAFT_ONLY: "Draft Only",
  ASK_FIRST: "Ask First",
};

/** Human-readable descriptions for modes */
export const MODE_DESCRIPTIONS: Record<string, string> = {
  DRAFT_ONLY: "Drafts everything for your review — never takes external actions on its own",
  ASK_FIRST: "Can take actions but always asks for your approval first via the dashboard",
};

export function templateLabel(id: string): string {
  return TEMPLATE_LABELS[id] ?? id;
}

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}
