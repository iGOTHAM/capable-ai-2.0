/** Human-readable labels for template IDs */
export const TEMPLATE_LABELS: Record<string, string> = {
  default: "Default",
  pe: "Private Equity",
  realestate: "Real Estate",
  general: "General",
};

export function templateLabel(id: string): string {
  return TEMPLATE_LABELS[id] ?? id;
}
