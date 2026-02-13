"use client";

interface Event {
  ts: string;
  runId: string;
  type: string;
  summary: string;
  risk?: string;
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `about ${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function getEventUser(_type: string): string {
  // In the future, distinguish between human and AI events
  return "henry";
}

export function CompactActivityItem({ event }: { event: Event }) {
  const user = getEventUser(event.type);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px] shadow-green-500/50" />
          <span className="text-xs font-medium text-green-400">{user}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatTimeAgo(event.ts)}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
        {event.summary}
      </p>
    </div>
  );
}
