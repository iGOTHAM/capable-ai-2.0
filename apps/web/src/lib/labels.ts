/** Human-readable labels for template IDs */
export const TEMPLATE_LABELS: Record<string, string> = {
  pe: "Private Equity",
  legal: "Legal",
  healthcare: "Healthcare",
  general: "General",
};

export function templateLabel(id: string): string {
  return TEMPLATE_LABELS[id] ?? id;
}
