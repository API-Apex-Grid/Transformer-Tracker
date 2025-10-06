"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Inspection } from "@/types/inspection";
import { apiUrl } from "@/lib/api";

type InspectionsContextValue = {
  inspections: Inspection[];
  addInspection: (i: Inspection) => void;
  updateInspection: (index: number, i: Inspection) => void;
  deleteInspection: (index: number) => void;
  reload: () => Promise<void>;
  lastError: string | null;
  loading: boolean;
  fetchInspectionById: (id: string) => Promise<Inspection | null>;
};

const InspectionsContext = createContext<InspectionsContextValue | undefined>(undefined);

export function InspectionsProvider({ children }: { children: React.ReactNode }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const load = async () => {
    try {
      setLastError(null);
      setLoading(true);
      const res = await fetch("/api/inspections?summary=1", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend responded ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
      }
      const data = await res.json();
      const normalized: Inspection[] = (Array.isArray(data) ? data : []).map((raw: unknown) => {
        if (typeof raw === 'object' && raw !== null) {
          const obj = raw as Record<string, unknown> & { transformer?: { transformerNumber?: string } };
          const transformerNumber = (obj.transformerNumber as string) ?? obj.transformer?.transformerNumber ?? "";
          // Parse boundingBoxes if it's a JSON string
          let boundingBoxes: unknown = (obj as any).boundingBoxes;
          if (typeof boundingBoxes === 'string') {
            try { boundingBoxes = JSON.parse(boundingBoxes); } catch { /* keep as string if invalid */ }
          }
          // Parse faultTypes if provided as string
          let faultTypes: unknown = (obj as any).faultTypes;
          if (typeof faultTypes === 'string') {
            try { faultTypes = JSON.parse(faultTypes); } catch { /* keep as string if invalid */ }
          }
          // faultType (string) comes straight from the API; include via spread
          return { ...(obj as object), transformerNumber, boundingBoxes, faultTypes } as Inspection;
        }
        return {
          transformerNumber: "",
          inspectionNumber: "",
          inspectedDate: "",
          maintainanceDate: "",
          branch: "",
          status: "",
        } as Inspection;
      });
      // Sort by natural numeric order of transformer number (e.g., TR1, TR2, ..., TR9, TR10)
      const numKey = (s: string | undefined) => {
        if (!s) return Number.POSITIVE_INFINITY;
        const m = s.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
      };
      normalized.sort((a, b) => {
        const na = numKey(a.transformerNumber);
        const nb = numKey(b.transformerNumber);
        if (na !== nb) return na - nb;
        return (a.transformerNumber || '').localeCompare(b.transformerNumber || '');
      });
      setInspections(normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error fetching inspections';
      console.error('[InspectionsContext] load failed:', err);
      setLastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Initial load only after login flag is present
  useEffect(() => {
    try {
      const logged = typeof window !== 'undefined' && localStorage.getItem('isLoggedIn') === 'true';
      if (logged) void load();
    } catch {
      // ignore
    }
  }, []);

  // Do not refetch on route change to avoid unnecessary reloads

  const fetchInspectionById = async (id: string): Promise<Inspection | null> => {
    try {
      const res = await fetch(`/api/inspections/${id}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const raw = await res.json();
      const normalized: Inspection = ((): Inspection => {
        if (typeof raw === 'object' && raw !== null) {
          const obj = raw as Record<string, unknown> & { transformer?: { transformerNumber?: string } };
          const transformerNumber = (obj.transformerNumber as string) ?? obj.transformer?.transformerNumber ?? "";
          let boundingBoxes: unknown = (obj as any).boundingBoxes;
          if (typeof boundingBoxes === 'string') {
            try { boundingBoxes = JSON.parse(boundingBoxes); } catch {}
          }
          let faultTypes: unknown = (obj as any).faultTypes;
          if (typeof faultTypes === 'string') {
            try { faultTypes = JSON.parse(faultTypes); } catch {}
          }
          return { ...(obj as object), transformerNumber, boundingBoxes, faultTypes } as Inspection;
        }
        return raw as Inspection;
      })();
      return normalized;
    } catch {
      return null;
    }
  };

  const addInspection = async (i: Inspection) => {
    let username: string | null = null;
    try { username = typeof window !== 'undefined' ? localStorage.getItem('username') : null; } catch {}
    const res = await fetch(apiUrl("/api/inspections"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Spring expects the transformer relation; map transformerNumber into a nested object
      body: JSON.stringify({
        inspectionNumber: i.inspectionNumber,
        inspectedDate: i.inspectedDate,
        maintainanceDate: i.maintainanceDate,
        branch: i.branch,
        status: i.status,
        uploadedBy: username,
        transformer: { transformerNumber: i.transformerNumber },
      }),
    });
    if (!res.ok) {
      const message = await res.json().catch(() => ({}));
      throw new Error(message?.error || "Failed to add inspection");
    }
  // Reload to pick up server-sourced fields and apply normalization
  await load();
  };

  const updateInspection = async (index: number, i: Inspection) => {
    const id = inspections[index]?.id;
    if (!id) return;
    const res = await fetch(apiUrl(`/api/inspections/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inspectionNumber: i.inspectionNumber,
        inspectedDate: i.inspectedDate,
        maintainanceDate: i.maintainanceDate,
        branch: i.branch,
        status: i.status,
        favourite: typeof i.favourite === 'boolean' ? i.favourite : undefined,
        transformer: { transformerNumber: i.transformerNumber },
      }),
    });
  // Reload to pick up server-sourced fields and apply normalization
  await load();
  };

  const deleteInspection = async (index: number) => {
    const id = inspections[index]?.id;
    if (!id) return;
  await fetch(apiUrl(`/api/inspections/${id}`), { method: "DELETE" });
  // Reload to reflect deletion and keep list in sync
  await load();
  };

  const value = useMemo(
    () => ({ inspections, addInspection, updateInspection, deleteInspection, reload: load, lastError, loading, fetchInspectionById }),
    [inspections, lastError, loading]
  );

  return <InspectionsContext.Provider value={value}>{children}</InspectionsContext.Provider>;
}

export function useInspections() {
  const ctx = useContext(InspectionsContext);
  if (!ctx) throw new Error("useInspections must be used within InspectionsProvider");
  return ctx;
}
