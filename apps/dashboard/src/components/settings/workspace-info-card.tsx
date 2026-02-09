"use client";

import { useState, useEffect } from "react";
import { Loader2, HardDrive, FileText, CheckSquare, Building2, Activity } from "lucide-react";

interface Stats {
  docCount: number;
  taskCount: number;
  projectCount: number;
  eventCount: number;
}

export function WorkspaceInfoCard() {
  const [stats, setStats] = useState<Stats>({
    docCount: 0,
    taskCount: 0,
    projectCount: 0,
    eventCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/docs").then((r) => (r.ok ? r.json() : { docs: [] })),
      fetch("/api/tasks").then((r) => (r.ok ? r.json() : { tasks: [], completed: [] })),
      fetch("/api/pipeline").then((r) => (r.ok ? r.json() : { projects: [] })),
      fetch("/api/events").then((r) => (r.ok ? r.json() : { events: [] })),
    ])
      .then(([docs, tasks, pipeline, events]) => {
        // Count docs by flattening tree
        let docCount = 0;
        interface DocNode { children?: DocNode[] }
        const countDocs = (entries: DocNode[]) => {
          for (const e of entries) {
            docCount++;
            if (e.children) countDocs(e.children);
          }
        };
        countDocs(docs.docs || []);

        setStats({
          docCount,
          taskCount: (tasks.tasks?.length || 0) + (tasks.completed?.length || 0),
          projectCount: pipeline.projects?.length || 0,
          eventCount: events.events?.length || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const items = [
    { icon: FileText, label: "Documents", value: stats.docCount },
    { icon: CheckSquare, label: "Tasks", value: stats.taskCount },
    { icon: Building2, label: "Projects", value: stats.projectCount },
    { icon: Activity, label: "Events", value: stats.eventCount },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <span className="text-lg font-semibold">Workspace</span>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Overview of your workspace data
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-lg border border-border bg-muted p-4 text-center"
            >
              <Icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
