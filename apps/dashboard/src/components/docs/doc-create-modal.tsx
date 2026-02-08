"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (path: string, type: "file" | "folder") => void;
}

const LOCATIONS = [
  { value: "knowledge", label: "Knowledge" },
  { value: "memory", label: "Memory" },
  { value: "deals", label: "Deals" },
];

export function DocCreateModal({
  open,
  onOpenChange,
  onSave,
}: DocCreateModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("knowledge");
  const [type, setType] = useState<"file" | "folder">("file");

  const handleSave = () => {
    if (!name.trim()) return;

    // Build path
    let fileName = name.trim();
    if (type === "file" && !fileName.includes(".")) {
      fileName += ".md"; // default to markdown
    }
    const fullPath = `${location}/${fileName}`;
    onSave(fullPath, type);
    onOpenChange(false);
    // Reset
    setName("");
    setLocation("knowledge");
    setType("file");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {type === "folder" ? "New Folder" : "New Document"}
          </DialogTitle>
          <DialogDescription>
            Create a new {type === "folder" ? "folder" : "document"} in your
            workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setType("file")}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                type === "file"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              Document
            </button>
            <button
              onClick={() => setType("folder")}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                type === "folder"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              Folder
            </button>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-2">
            <Label>Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc.value} value={loc.value}>
                    {loc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-name">Name</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "folder" ? "folder-name" : "document-name.md"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSave();
              }}
              autoFocus
            />
            {type === "file" && (
              <p className="text-[10px] text-muted-foreground">
                .md extension added automatically if not specified
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
