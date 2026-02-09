"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { DocSidebar } from "@/components/docs/doc-sidebar";
import { DocViewer } from "@/components/docs/doc-viewer";
import { DocCreateModal } from "@/components/docs/doc-create-modal";
import { Loader2, Menu, X } from "lucide-react";
import type { DocEntry } from "@/lib/docs";

export default function DocsPage() {
  const searchParams = useSearchParams();
  const initialPath = searchParams.get("path");

  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath);
  const [createOpen, setCreateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Update selectedPath when search params change (deep-linking from search)
  useEffect(() => {
    const pathParam = searchParams.get("path");
    if (pathParam) {
      setSelectedPath(pathParam);
    }
  }, [searchParams]);

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

  const handleSelectDoc = (path: string | null) => {
    setSelectedPath(path);
    setSidebarOpen(false); // close sidebar on mobile after selection
  };

  return (
    <div className="-m-4 sm:-m-6 flex flex-col">
      {/* Mobile sidebar toggle */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <span className="text-sm text-muted-foreground">
          {selectedPath ? selectedPath.split("/").pop() : "Documents"}
        </span>
      </div>

      <div className="flex h-[calc(100vh-7.5rem)] overflow-hidden">
        {/* Sidebar — always visible on md+, toggleable on mobile */}
        <div className={`w-64 shrink-0 ${sidebarOpen ? "block" : "hidden"} md:block`}>
          <DocSidebar
            docs={docs}
            selectedPath={selectedPath}
            onSelect={handleSelectDoc}
            onNewDoc={() => setCreateOpen(true)}
          />
        </div>

        {/* Viewer — hidden on mobile when sidebar is open */}
        <div className={`flex-1 ${sidebarOpen ? "hidden md:block" : "block"}`}>
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
