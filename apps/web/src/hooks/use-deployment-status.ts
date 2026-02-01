"use client";

import { useState, useEffect, useCallback } from "react";

interface DeploymentStatus {
  status: string;
  dropletIp: string | null;
  lastHeartbeatAt: string | null;
  activePackVer: number | null;
}

export function useDeploymentStatus(
  projectId: string,
  initialStatus: DeploymentStatus,
  pollInterval = 10000,
) {
  const [data, setData] = useState<DeploymentStatus>(initialStatus);
  const [isPolling, setIsPolling] = useState(
    initialStatus.status === "PENDING" || initialStatus.status === "PROVISIONING",
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/deployments/${projectId}/status`);
      if (res.ok) {
        const newData = await res.json();
        setData(newData);
        if (newData.status === "ACTIVE" || newData.status === "DEACTIVATED") {
          setIsPolling(false);
        }
      }
    } catch {
      // Silently fail on poll errors
    }
  }, [projectId]);

  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [isPolling, pollInterval, refresh]);

  return { ...data, refresh, isPolling };
}
