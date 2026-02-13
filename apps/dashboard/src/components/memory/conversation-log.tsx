"use client";

import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatEvent {
  ts: string;
  type: string;
  summary: string;
  runId: string;
}

export interface ConversationDay {
  date: string; // "2026-02-13"
  label: string; // "Thu, Feb 13"
  messageCount: number;
  messages: ChatEvent[];
}

interface ConversationLogProps {
  chatEvents: ChatEvent[];
  selectedConversation: string | null;
  onSelect: (date: string) => void;
}

function groupByDate(events: ChatEvent[]): ConversationDay[] {
  const groups = new Map<string, ChatEvent[]>();

  for (const event of events) {
    const date = event.ts.slice(0, 10); // "2026-02-13"
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(event);
  }

  const days: ConversationDay[] = [];
  for (const [date, messages] of groups) {
    const d = new Date(date + "T00:00:00");
    days.push({
      date,
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      messageCount: messages.length,
      messages: messages.sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
      ),
    });
  }

  // Sort newest first
  return days.sort((a, b) => b.date.localeCompare(a.date));
}

export function ConversationLog({
  chatEvents,
  selectedConversation,
  onSelect,
}: ConversationLogProps) {
  const days = useMemo(() => groupByDate(chatEvents), [chatEvents]);

  if (days.length === 0) {
    return (
      <p className="px-4 py-4 text-xs text-muted-foreground/50 text-center">
        No conversations yet
      </p>
    );
  }

  return (
    <>
      {days.map((day) => {
        const isSelected = selectedConversation === day.date;
        return (
          <button
            key={day.date}
            onClick={() => onSelect(day.date)}
            className={cn(
              "flex w-full items-center gap-2.5 pl-8 pr-4 py-2 text-left transition-colors",
              "hover:bg-accent/50",
              isSelected && "bg-accent",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-xs",
                  isSelected
                    ? "text-foreground font-medium"
                    : "text-foreground/70",
                )}
              >
                {day.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {day.messageCount} message{day.messageCount !== 1 ? "s" : ""}
              </p>
            </div>
          </button>
        );
      })}
    </>
  );
}
