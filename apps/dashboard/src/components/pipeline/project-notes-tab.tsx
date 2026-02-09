"use client";

import { useState, useEffect } from "react";
import { Loader2, StickyNote, Send } from "lucide-react";

interface Note {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

interface ProjectNotesTabProps {
  projectId: string;
}

export function ProjectNotesTab({ projectId }: ProjectNotesTabProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [sending, setSending] = useState(false);

  const fetchNotes = () => {
    fetch(`/api/pipeline/projects/${projectId}/notes`)
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  const handleAddNote = async () => {
    if (!newNote.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/pipeline/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNote.trim(), author: "User" }),
      });
      if (res.ok) {
        setNewNote("");
        setLoading(true);
        fetchNotes();
      }
    } catch {
      // Silent fail
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add note form */}
      <div className="rounded-xl border border-border bg-card p-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleAddNote();
            }
          }}
          placeholder="Add a note..."
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            ⌘+Enter to send
          </span>
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim() || sending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Add Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
          <StickyNote className="h-10 w-10 text-muted-foreground opacity-30" />
          <div className="text-center">
            <p className="text-sm font-medium">No notes yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a note to track observations and decisions.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...notes].reverse().map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-sm leading-relaxed">{note.text}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {note.author}
                </span>
                <span>·</span>
                <span>
                  {new Date(note.timestamp).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
