"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { ContentBoard } from "@/components/content/content-board";

export interface ContentItem {
  path: string;
  name: string;
  category: string;
  modified?: string;
  size?: number;
}

/** Content-production folder names */
const CONTENT_FOLDERS = new Set([
  "scripts",
  "youtube-scripts",
  "newsletters",
  "tweets",
  "threads",
  "social",
  "content",
]);

/** Content-production categories from the classification system */
const CONTENT_CATEGORIES = new Set([
  "scripts",
  "newsletters",
  "social",
  "content",
]);

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

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
          // Include files from content-production folders or with content categories
          const topFolder = node.path.split("/")[0] || "";
          const isContentFile =
            CONTENT_FOLDERS.has(topFolder) ||
            CONTENT_CATEGORIES.has(node.category || "");
          if (isContentFile && node.path && !node.children) {
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

  return <ContentBoard items={items} />;
}
