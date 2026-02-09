"use client";

import { useState, useEffect, useCallback } from "react";
import { DocSidebar } from "@/components/docs/doc-sidebar";
import { DocViewer } from "@/components/docs/doc-viewer";
import { DocCreateModal } from "@/components/docs/doc-create-modal";
import { Loader2 } from "lucide-react";
import type { DocEntry } from "@/lib/docs";

export default function DocsPage() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      if (!res.ok) throw new Error("Failed to fetch docs");
      const data = await res.json();
      setDocs(data.docs || []);
    } catch {
      // Silent fail — empty docs is fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Find the selected doc entry for editability info
  const findDoc = (
    entries: DocEntry[],
    path: string,
  ): DocEntry | undefined => {
    for (const entry of entries) {
      if (entry.path === path) return entry;
      if (entry.children) {
        const found = findDoc(entry.children, path);
        if (found) return found;
      }
    }
    return undefined;
  };

  const selectedDoc = selectedPath ? findDoc(docs, selectedPath) : undefined;

  const handleCreateDoc = async (
    docPath: string,
    type: "file" | "folder",
  ) => {
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: docPath,
          type,
          content: type === "file" ? `# ${docPath.split("/").pop()?.replace(".md", "") || "New Document"}\n\n` : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      await fetchDocs();
      if (type === "file") {
        setSelectedPath(docPath);
      }
    } catch {
      // TODO: show error toast
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="-m-6 flex flex-col">
      <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <DocSidebar
            docs={docs}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            onNewDoc={() => setCreateOpen(true)}
          />
        </div>

        {/* Viewer */}
        <div className="flex-1">
          <DocViewer
            path={selectedPath}
            editable={selectedDoc?.editable ?? false}
          />
        </div>
      </div>

      <DocCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreateDoc}
      />
    </div>
  );
}
