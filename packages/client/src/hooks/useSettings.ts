import { useState, useEffect, useCallback } from "react";
import type { ServiceStatus } from "@studentassist/shared";
import {
  fetchServiceStatuses,
  saveServiceKey,
  disconnectGoogle,
} from "../lib/api";

export function useSettings() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchServiceStatuses();
      setStatuses(data);
    } catch (err: any) {
      setError(err.message || "Failed to load service statuses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveKey = useCallback(
    async (service: string, value: string) => {
      setSaving(service);
      try {
        await saveServiceKey(service, value);
        await refresh();
      } catch (err: any) {
        throw err;
      } finally {
        setSaving(null);
      }
    },
    [refresh]
  );

  const disconnectGoogleAccount = useCallback(async () => {
    setSaving("calendar");
    try {
      await disconnectGoogle();
      await refresh();
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(null);
    }
  }, [refresh]);

  const getStatus = useCallback(
    (service: string): ServiceStatus | undefined => {
      return statuses.find((s) => s.service === service);
    },
    [statuses]
  );

  return {
    statuses,
    loading,
    error,
    saving,
    refresh,
    saveKey,
    disconnectGoogleAccount,
    getStatus,
  };
}
