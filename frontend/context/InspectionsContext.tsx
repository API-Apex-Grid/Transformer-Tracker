"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Inspection } from "@/types/inspection";
import { apiUrl } from "@/lib/api";

type InspectionsContextValue = {
  inspections: Inspection[];
  addInspection: (i: Inspection) => void;
  updateInspection: (index: number, i: Inspection) => void;
  deleteInspection: (index: number) => void;
  reload: () => Promise<void>;
};

const InspectionsContext = createContext<InspectionsContextValue | undefined>(undefined);

export function InspectionsProvider({ children }: { children: React.ReactNode }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const pathname = usePathname();

  const load = async () => {
    const res = await fetch(apiUrl("/api/inspections"), { cache: "no-store" });
    const data = await res.json();
    setInspections(data);
  };

  // Initial load
  useEffect(() => {
    void load();
  }, []);

  // Refetch on route change
  useEffect(() => {
    if (!pathname) return;
    void load();
  }, [pathname]);

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
    const created = await res.json();
    setInspections((prev) => [...prev, created]);
  void load();
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
        transformer: { transformerNumber: i.transformerNumber },
      }),
    });
    const updated = await res.json();
    setInspections((prev) => prev.map((it, idx) => (idx === index ? updated : it)));
  void load();
  };

  const deleteInspection = async (index: number) => {
    const id = inspections[index]?.id;
    if (!id) return;
  await fetch(apiUrl(`/api/inspections/${id}`), { method: "DELETE" });
    setInspections((prev) => prev.filter((_, idx) => idx !== index));
  void load();
  };

  const value = useMemo(
    () => ({ inspections, addInspection, updateInspection, deleteInspection, reload: load }),
    [inspections]
  );

  return <InspectionsContext.Provider value={value}>{children}</InspectionsContext.Provider>;
}

export function useInspections() {
  const ctx = useContext(InspectionsContext);
  if (!ctx) throw new Error("useInspections must be used within InspectionsProvider");
  return ctx;
}
