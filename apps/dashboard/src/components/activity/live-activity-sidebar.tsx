"use client";

import { useState, useEffect, useCallback } from "react";
import { CompactActivityItem } from "./compact-activity-item";

interface Event {
  ts: string;
  runId: string;
  type: string;
  summary: string;
  risk?: string;
}

export function LiveActivitySidebar({ className }: { className?: string }) {
  const [events, setEvents] = useState<Event[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.events || [])
          .sort(
            (a: Event, b: Event) =>
              new Date(b.ts).getTime() - new Date(a.ts).getTime(),
          )
          .slice(0, 20);
        setEvents(sorted);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 px-1 pb-3">
        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px] shadow-green-500/50" />
        <h3 className="text-sm font-semibold text-foreground">
          Live Activity
        </h3>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto pr-1 scrollbar-hide" style={{ maxHeight: "calc(100vh - 200px)" }}>
        {events.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No activity yet
          </p>
        ) : (
          events.map((event, i) => (
            <CompactActivityItem key={`${event.ts}-${i}`} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
