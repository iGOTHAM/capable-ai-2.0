"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText } from "lucide-react";
import { ContentBoard } from "@/components/content/content-board";

interface ContentItem {
  path: string;
  name: string;
  category: string;
  modified?: string;
  size?: number;
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      // Flatten doc tree and filter for content-type files
      const flat: ContentItem[] = [];
      interface DocNode {
        path: string;
        name: string;
        category?: string;
        modified?: string;
        size?: number;
        children?: DocNode[];
      }
      const flatten = (nodes: DocNode[]) => {
        for (const node of nodes) {
          // Include knowledge, uploads, and other content-relevant files
          // Exclude system files like AGENTS.md, config files
          const isContent =
            node.category === "knowledge" ||
            node.category === "upload" ||
            node.category === "content" ||
            node.path.startsWith("knowledge/") ||
            (node.path.endsWith(".md") &&
              !node.path.startsWith("memory/") &&
              node.path !== "MEMORY.md" &&
              node.path !== "AGENTS.md" &&
              node.path !== "SOUL.md" &&
              node.path !== "USER.md");
          if (isContent && node.path && !node.children) {
            flat.push({
              path: node.path,
              name: node.name || node.path.split("/").pop() || node.path,
              category: node.category || "content",
              modified: node.modified,
              size: node.size,
            });
          }
          if (node.children) flatten(node.children);
        }
      };
      flatten(data.docs || []);
      setItems(flat);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium">No content yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Knowledge base articles and uploaded content will appear here.
          </p>
        </div>
      </div>
    );
  }

  return <ContentBoard items={items} />;
}
