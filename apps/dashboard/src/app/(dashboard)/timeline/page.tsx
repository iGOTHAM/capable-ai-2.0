"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
import { ActivityItem } from "@/components/activity/activity-item";
import { ActivityFilters } from "@/components/activity/activity-filters";

interface Event {
  ts: string;
  runId: string;
  type: string;
  summary: string;
  risk?: string;
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const eventDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (eventDate.getTime() === today.getTime()) return "Today";
  if (eventDate.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function matchesTypeFilter(eventType: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "run")
    return eventType === "run.started" || eventType === "run.finished";
  if (filter === "tool")
    return eventType === "tool.called" || eventType === "tool.result";
  if (filter === "plan") return eventType === "plan.created";
  if (filter === "approval")
    return (
      eventType === "approval.requested" ||
      eventType === "approval.resolved"
    );
  if (filter === "chat")
    return (
      eventType === "chat.user_message" || eventType === "chat.bot_message"
    );
  if (filter === "memory") return eventType === "memory.write";
  if (filter === "error")
    return eventType === "error" || eventType === "security.warning";
  return true;
}

function matchesDateFilter(ts: string, filter: string): boolean {
  if (filter === "all") return true;
  const days = parseInt(filter, 10);
  const cutoff = Date.now() - days * 86400000;
  return new Date(ts).getTime() >= cutoff;
}

export default function TimelinePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("7");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/events")
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = useMemo(() => {
    const searchLower = search.toLowerCase();
    return events
      .filter((e) => matchesTypeFilter(e.type, typeFilter))
      .filter((e) => matchesDateFilter(e.ts, dateFilter))
      .filter(
        (e) =>
          !search || e.summary.toLowerCase().includes(searchLower),
      )
      .reverse(); // newest first
  }, [events, typeFilter, dateFilter, search]);

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: Event[] }[] = [];
    let currentLabel = "";

    for (const event of filteredEvents) {
      const label = getDateLabel(event.ts);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, events: [] });
      }
      groups[groups.length - 1]!.events.push(event);
    }

    return groups;
  }, [filteredEvents]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <ActivityFilters
          typeFilter={typeFilter}
          dateFilter={dateFilter}
          search={search}
          onTypeChange={setTypeFilter}
          onDateChange={setDateFilter}
          onSearchChange={setSearch}
        />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ActivityFilters
        typeFilter={typeFilter}
        dateFilter={dateFilter}
        search={search}
        onTypeChange={setTypeFilter}
        onDateChange={setDateFilter}
        onSearchChange={setSearch}
      />

      {groupedEvents.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium">No events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Events will appear here as your assistant works.
            </p>
          </div>
        </div>
      ) : (
        groupedEvents.map((group) => (
          <div key={group.label}>
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              {group.label}
            </div>
            <div className="flex flex-col gap-2.5">
              {group.events.map((event, i) => (
                <ActivityItem key={`${event.runId}-${i}`} event={event} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
