// Shared demo data for the pipeline and project overview pages.
// All data is hardcoded — the dashboard has no project database.

// ─── Pipeline types ───────────────────────────────────────────────

export interface Stage {
  id: string;
  label: string;
}

export interface Project {
  id: string;
  name: string;
  stage: string;
  metric: { label: string; value: string };
  category: string;
  flags: number;
  flagStatus: "warning" | "clean" | "info";
  flagLabel: string;
  taskCount: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  stage: string;
  category: string;
  location: string;
  details: string;
  metrics: { label: string; value: string; accent?: boolean }[];
  flags: { title: string; description: string }[];
  nextSteps: { text: string; done: boolean }[];
  latestNote: { text: string; author: string; timeAgo: string };
}

// ─── Pipeline stages ──────────────────────────────────────────────

export const STAGES: Stage[] = [
  { id: "sourcing", label: "Sourcing" },
  { id: "underwriting", label: "Underwriting" },
  { id: "due-diligence", label: "Due Diligence" },
  { id: "under-contract", label: "Under Contract" },
];

// ─── Demo projects (pipeline cards) ───────────────────────────────

export const DEMO_PROJECTS: Project[] = [
  {
    id: "1",
    name: "Riverside Apartments",
    stage: "sourcing",
    metric: { label: "NOI", value: "$4.2M" },
    category: "Multifamily",
    flags: 2,
    flagStatus: "warning",
    flagLabel: "2 flags",
    taskCount: 3,
  },
  {
    id: "2",
    name: "Oak Street Office",
    stage: "sourcing",
    metric: { label: "NOI", value: "$1.8M" },
    category: "Office",
    flags: 0,
    flagStatus: "clean",
    flagLabel: "Clean",
    taskCount: 1,
  },
  {
    id: "3",
    name: "Harbor Industrial",
    stage: "sourcing",
    metric: { label: "NOI", value: "$3.5M" },
    category: "Industrial",
    flags: 0,
    flagStatus: "info",
    flagLabel: "New docs",
    taskCount: 5,
  },
  {
    id: "4",
    name: "Metro Retail Center",
    stage: "underwriting",
    metric: { label: "NOI", value: "$2.1M" },
    category: "Retail",
    flags: 1,
    flagStatus: "warning",
    flagLabel: "1 flag",
    taskCount: 4,
  },
  {
    id: "5",
    name: "Sunset Medical",
    stage: "underwriting",
    metric: { label: "NOI", value: "$890K" },
    category: "Medical Office",
    flags: 0,
    flagStatus: "clean",
    flagLabel: "Clean",
    taskCount: 2,
  },
  {
    id: "6",
    name: "Gateway Business Park",
    stage: "due-diligence",
    metric: { label: "NOI", value: "$5.8M" },
    category: "Industrial",
    flags: 0,
    flagStatus: "info",
    flagLabel: "LOI Due Fri",
    taskCount: 8,
  },
];

// ─── Project detail data (project overview page) ─────────────────

export const DEMO_PROJECT_DETAILS: Record<string, ProjectDetail> = {
  "1": {
    id: "1",
    name: "Riverside Apartments",
    stage: "sourcing",
    category: "Multifamily",
    location: "Austin, TX",
    details: "142 Units \u00B7 Class B \u00B7 2004 Built",
    metrics: [
      { label: "NOI", value: "$4.2M" },
      { label: "Asking Price", value: "$62M" },
      { label: "Cap Rate", value: "6.8%", accent: true },
      { label: "Price/Unit", value: "$436K" },
    ],
    flags: [
      {
        title: "Tenant concentration risk",
        description:
          "Top 3 tenants represent 45% of rental income. Significant NOI impact if any leave.",
      },
      {
        title: "Deferred maintenance unclear",
        description:
          "Property condition report shows HVAC issues but no cost estimate provided.",
      },
    ],
    nextSteps: [
      { text: "Complete rent roll analysis", done: false },
      { text: "Schedule property tour", done: false },
      { text: "Request updated T12", done: false },
    ],
    latestNote: {
      text: "Spoke with broker \u2014 seller is motivated, original buyer fell through. May be room to negotiate on price if we move quickly.",
      author: "Atlas",
      timeAgo: "2 hours ago",
    },
  },
  "2": {
    id: "2",
    name: "Oak Street Office",
    stage: "sourcing",
    category: "Office",
    location: "Denver, CO",
    details: "85,000 SF \u00B7 Class A \u00B7 2018 Built",
    metrics: [
      { label: "NOI", value: "$1.8M" },
      { label: "Asking Price", value: "$28M" },
      { label: "Cap Rate", value: "6.4%", accent: true },
      { label: "Price/SF", value: "$329" },
    ],
    flags: [],
    nextSteps: [{ text: "Review offering memorandum", done: false }],
    latestNote: {
      text: "Initial review looks promising. Strong tenant mix with weighted average lease term of 6.2 years.",
      author: "Atlas",
      timeAgo: "1 day ago",
    },
  },
  "3": {
    id: "3",
    name: "Harbor Industrial",
    stage: "sourcing",
    category: "Industrial",
    location: "Houston, TX",
    details: "220,000 SF \u00B7 Class B \u00B7 1998 Built",
    metrics: [
      { label: "NOI", value: "$3.5M" },
      { label: "Asking Price", value: "$48M" },
      { label: "Cap Rate", value: "7.3%", accent: true },
      { label: "Price/SF", value: "$218" },
    ],
    flags: [],
    nextSteps: [
      { text: "Review environmental Phase I", done: false },
      { text: "Analyze tenant credit profiles", done: false },
      { text: "Compare to recent industrial comps", done: false },
      { text: "Schedule site visit", done: false },
      { text: "Request rent roll details", done: false },
    ],
    latestNote: {
      text: "New offering docs received from CBRE. Port-adjacent location with strong logistics demand drivers.",
      author: "Atlas",
      timeAgo: "3 hours ago",
    },
  },
  "4": {
    id: "4",
    name: "Metro Retail Center",
    stage: "underwriting",
    category: "Retail",
    location: "Phoenix, AZ",
    details: "165,000 SF \u00B7 Anchored \u00B7 2006 Built",
    metrics: [
      { label: "NOI", value: "$2.1M" },
      { label: "Asking Price", value: "$31M" },
      { label: "Cap Rate", value: "6.8%", accent: true },
      { label: "Price/SF", value: "$188" },
    ],
    flags: [
      {
        title: "Anchor tenant lease expiring",
        description:
          "Primary anchor (32% of GLA) has lease expiring in 18 months with no renewal option exercised yet.",
      },
    ],
    nextSteps: [
      { text: "Build underwriting model", done: true },
      { text: "Contact anchor tenant for renewal intent", done: false },
      { text: "Review co-tenancy clauses", done: false },
      { text: "Pull traffic count data", done: false },
    ],
    latestNote: {
      text: "Underwriting model draft complete. Returns look marginal at ask \u2014 need 8-10% discount to hit our hurdle.",
      author: "Atlas",
      timeAgo: "5 hours ago",
    },
  },
  "5": {
    id: "5",
    name: "Sunset Medical",
    stage: "underwriting",
    category: "Medical Office",
    location: "San Diego, CA",
    details: "45,000 SF \u00B7 Class A \u00B7 2020 Built",
    metrics: [
      { label: "NOI", value: "$890K" },
      { label: "Asking Price", value: "$14.8M" },
      { label: "Cap Rate", value: "6.0%", accent: true },
      { label: "Price/SF", value: "$329" },
    ],
    flags: [],
    nextSteps: [
      { text: "Verify tenant medical licenses", done: false },
      { text: "Review TI obligations", done: false },
    ],
    latestNote: {
      text: "All tenants are healthcare providers with strong credit. Building is LEED certified with modern infrastructure.",
      author: "Atlas",
      timeAgo: "1 day ago",
    },
  },
  "6": {
    id: "6",
    name: "Gateway Business Park",
    stage: "due-diligence",
    category: "Industrial",
    location: "Dallas, TX",
    details: "380,000 SF \u00B7 Class A \u00B7 2015 Built",
    metrics: [
      { label: "NOI", value: "$5.8M" },
      { label: "Asking Price", value: "$82M" },
      { label: "Cap Rate", value: "7.1%", accent: true },
      { label: "Price/SF", value: "$216" },
    ],
    flags: [],
    nextSteps: [
      { text: "Complete Phase I environmental", done: true },
      { text: "Finalize LOI terms", done: false },
      { text: "Engage legal counsel", done: false },
      { text: "Order updated appraisal", done: false },
      { text: "Review title commitment", done: false },
      { text: "Confirm insurance quotes", done: false },
      { text: "Schedule lender site visit", done: false },
      { text: "Prepare IC memo draft", done: false },
    ],
    latestNote: {
      text: "LOI submitted at $79M. Seller countered at $81M. Recommend accepting \u2014 still pencils at 7%+ cap rate.",
      author: "Atlas",
      timeAgo: "30 minutes ago",
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

export function getProjectById(id: string): ProjectDetail | undefined {
  return DEMO_PROJECT_DETAILS[id];
}

export function getProjectSummary(id: string): Project | undefined {
  return DEMO_PROJECTS.find((p) => p.id === id);
}

// ─── AI Summary demo data ─────────────────────────────────────────

export interface AiSummaryData {
  keyPoints: { text: string; flagged?: boolean }[];
}

export const AI_SUMMARIES: Record<string, AiSummaryData> = {
  "SOUL.md": {
    keyPoints: [
      { text: "Defines agent identity as a real estate investment analyst" },
      { text: "Operating principles focus on accuracy, proactivity, and structured analysis" },
      { text: "Mission includes deal sourcing, underwriting support, and portfolio monitoring" },
      { text: "Communication style is professional, concise, and data-driven" },
    ],
  },
  "AGENTS.md": {
    keyPoints: [
      { text: "Session start protocol: read memory, check tasks, review directives" },
      { text: "Full tool access: web search, file operations, browser, cron, memory" },
      { text: "Workspace structure defined: uploads/, deals/, knowledge/, memory/" },
      { text: "Self-governance rules for autonomous operation and error recovery" },
      {
        text: "Trust & safety boundaries must be followed for all external actions",
        flagged: true,
      },
    ],
  },
  "MEMORY.md": {
    keyPoints: [
      { text: "Long-term memory storage with pipeline tracking tables" },
      { text: "Knowledge catalog indexes all workspace files by category" },
      { text: "Proactive workflow suggestions for daily operations" },
      { text: "Contact and relationship tracking framework" },
    ],
  },
  "USER.md": {
    keyPoints: [
      { text: "User profile with organization context and role definition" },
      { text: "Communication preferences and response format guidelines" },
      { text: "Goals and priorities for the current engagement period" },
    ],
  },
  "realestate.md": {
    keyPoints: [
      { text: "Cap rate, NOI, and cash-on-cash return calculation frameworks" },
      { text: "Property type primers: multifamily, office, industrial, retail" },
      { text: "Investment memo template with standardized sections" },
      { text: "Due diligence checklist covering 12 key areas" },
      {
        text: "Market risk factors to flag: interest rate sensitivity, tenant concentration",
        flagged: true,
      },
    ],
  },
  "directives.md": {
    keyPoints: [
      { text: "Standing orders for daily communication cadence" },
      { text: "Task management rules: prioritize by urgency and impact" },
      { text: "Error handling protocols for failed tool executions" },
    ],
  },
  "lessons-learned.md": {
    keyPoints: [
      { text: "Self-improvement tracker for agent performance optimization" },
      { text: "Pattern recognition from past interactions and corrections" },
    ],
  },
};

// ─── Extracted Metrics demo data ──────────────────────────────────

export interface ExtractedMetricData {
  label: string;
  value: string;
}

export const EXTRACTED_METRICS: Record<string, ExtractedMetricData[]> = {
  "realestate.md": [
    { label: "Avg Cap Rate (Multifamily)", value: "5.5% - 7.0%" },
    { label: "Avg Cap Rate (Industrial)", value: "6.0% - 7.5%" },
    { label: "Avg Cap Rate (Office)", value: "6.5% - 8.0%" },
    { label: "Target Cash-on-Cash", value: "8% - 12%" },
  ],
};
