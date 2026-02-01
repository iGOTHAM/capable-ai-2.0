"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

export function RegenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/packs/${projectId}/generate`, {
        method: "POST",
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to regenerate pack");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={handleRegenerate} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Regenerating...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate Pack
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
