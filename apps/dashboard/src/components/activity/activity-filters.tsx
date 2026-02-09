"use client";

interface ActivityFiltersProps {
  typeFilter: string;
  dateFilter: string;
  search: string;
  onTypeChange: (type: string) => void;
  onDateChange: (date: string) => void;
  onSearchChange: (search: string) => void;
}

const EVENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "run", label: "Runs" },
  { value: "tool", label: "Tools" },
  { value: "plan", label: "Plans" },
  { value: "approval", label: "Approvals" },
  { value: "chat", label: "Chat" },
  { value: "memory", label: "Memory" },
  { value: "error", label: "Errors" },
];

const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export function ActivityFilters({
  typeFilter,
  dateFilter,
  search,
  onTypeChange,
  onDateChange,
  onSearchChange,
}: ActivityFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
        className="h-10 cursor-pointer rounded-lg border border-border bg-card px-3 text-[13px] text-foreground"
      >
        {EVENT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        value={dateFilter}
        onChange={(e) => onDateChange(e.target.value)}
        className="h-10 cursor-pointer rounded-lg border border-border bg-card px-3 text-[13px] text-foreground"
      >
        {DATE_RANGES.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search activity..."
        className="h-10 w-60 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
