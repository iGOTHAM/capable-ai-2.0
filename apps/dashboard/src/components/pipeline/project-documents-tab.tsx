"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, FolderPlus, Loader2, ExternalLink } from "lucide-react";

interface DocEntry {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  modified?: string;
  children?: DocEntry[];
}

interface ProjectDocumentsTabProps {
  projectName: string;
}

function flattenDocs(entries: DocEntry[]): DocEntry[] {
  const flat: DocEntry[] = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      flat.push(entry);
    }
    if (entry.children) {
      flat.push(...flattenDocs(entry.children));
    }
  }
  return flat;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ProjectDocumentsTab({ projectName }: ProjectDocumentsTabProps) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((data) => setDocs(data.docs || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allFiles = flattenDocs(docs);
  const projectSlug = projectName.toLowerCase().replace(/\s+/g, "-");

  // Separate project-specific docs from general docs
  const projectDocs = allFiles.filter(
    (d) =>
      d.path.toLowerCase().includes(`deals/${projectSlug}`) ||
      d.path.toLowerCase().includes(projectName.toLowerCase()),
  );
  const otherDocs = allFiles.filter(
    (d) => !projectDocs.includes(d),
  );

  const handleCreateFolder = async () => {
    try {
      await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `deals/${projectName}`,
          type: "folder",
        }),
      });
      // Refetch
      const res = await fetch("/api/docs");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.docs || []);
      }
    } catch {
      // Silent fail
    }
  };

  const DocRow = ({ doc }: { doc: DocEntry }) => (
    <button
      onClick={() => router.push(`/docs?path=${encodeURIComponent(doc.path)}`)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{doc.name}</div>
        <div className="truncate text-xs text-muted-foreground">{doc.path}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
        {doc.size !== undefined && <span>{formatSize(doc.size)}</span>}
        {doc.modified && (
          <span>{new Date(doc.modified).toLocaleDateString()}</span>
        )}
        <ExternalLink className="h-3 w-3" />
      </div>
    </button>
  );

  if (allFiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
        <FileText className="h-10 w-10 text-muted-foreground opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">No documents yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a project folder to start organizing documents.
          </p>
        </div>
        <button
          onClick={handleCreateFolder}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <FolderPlus className="h-4 w-4" />
          Create Project Folder
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {projectDocs.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project Documents
            </h4>
          </div>
          <div className="p-2">
            {projectDocs.map((doc) => (
              <DocRow key={doc.path} doc={doc} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            All Workspace Documents
          </h4>
          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <FolderPlus className="h-3 w-3" />
            Create Folder
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {otherDocs.map((doc) => (
            <DocRow key={doc.path} doc={doc} />
          ))}
        </div>
      </div>
    </div>
  );
}
