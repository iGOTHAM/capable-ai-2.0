"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, FileText } from "lucide-react";
import { useState } from "react";

interface PackFilesViewerProps {
  files: Record<string, string>;
}

/** Files to display, in order. Skip operational files. */
const FILE_ORDER = [
  "SOUL.md",
  "USER.md",
  "AGENTS.md",
  "MEMORY.md",
  "memory/directives.md",
  "memory/lessons-learned.md",
  "tasks.json",
  "knowledge/",
  "memory/",
];

const SKIP_FILES = [
  "activity/events.ndjson",
  "configPatch.json",
];

function getDisplayName(filename: string): string {
  if (filename.startsWith("knowledge/")) {
    return `Knowledge — ${filename.replace("knowledge/", "").replace(".md", "")}`;
  }
  if (filename === "memory/directives.md") return "Standing Orders";
  if (filename === "memory/lessons-learned.md") return "Lessons Learned";
  if (filename.startsWith("memory/") && filename.endsWith(".md")) {
    const dateMatch = filename.match(/memory\/(\d{4}-\d{2}-\d{2})\.md/);
    if (dateMatch) return `Daily Log — ${dateMatch[1]}`;
    return filename.replace("memory/", "").replace(".md", "");
  }
  if (filename === "tasks.json") return "Tasks";
  return filename.replace(".md", "");
}

export function PackFilesViewer({ files }: PackFilesViewerProps) {
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  // Sort files according to FILE_ORDER, skip operational ones
  const sortedEntries = Object.entries(files)
    .filter(([key]) => !SKIP_FILES.includes(key))
    .sort(([a], [b]) => {
      const aIdx = FILE_ORDER.findIndex((f) =>
        f.endsWith("/") ? a.startsWith(f) : a === f,
      );
      const bIdx = FILE_ORDER.findIndex((f) =>
        f.endsWith("/") ? b.startsWith(f) : b === f,
      );
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

  if (sortedEntries.length === 0) return null;

  const toggleFile = (filename: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1">
      {sortedEntries.map(([filename, content]) => {
        const lineCount = content.split("\n").length;
        const isOpen = openFiles.has(filename);

        return (
          <Collapsible
            key={filename}
            open={isOpen}
            onOpenChange={() => toggleFile(filename)}
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors">
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">
                {getDisplayName(filename)}
              </span>
              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                {lineCount} lines
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-9 mr-3 mb-2 max-h-80 overflow-y-auto rounded-md bg-muted p-3">
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono">
                  {content}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
