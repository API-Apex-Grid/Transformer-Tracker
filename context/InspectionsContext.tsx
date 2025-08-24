"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Inspection } from "@/types/inspection";

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
    const res = await fetch("/api/inspections", { cache: "no-store" });
    const data = await res.json();
    setInspections(data);
  };

  // Initial load
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch on route change
  useEffect(() => {
    if (!pathname) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const addInspection = async (i: Inspection) => {
    let username: string | null = null;
    try { username = typeof window !== 'undefined' ? localStorage.getItem('username') : null; } catch {}
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...i, uploadedBy: username }),
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
    const res = await fetch(`/api/inspections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(i),
    });
    const updated = await res.json();
    setInspections((prev) => prev.map((it, idx) => (idx === index ? updated : it)));
  void load();
  };

  const deleteInspection = async (index: number) => {
    const id = inspections[index]?.id;
    if (!id) return;
    await fetch(`/api/inspections/${id}`, { method: "DELETE" });
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
