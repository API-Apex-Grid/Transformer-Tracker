"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Inspection } from "@/types/inspection";

type InspectionsContextValue = {
  inspections: Inspection[];
  addInspection: (i: Inspection) => void;
  updateInspection: (index: number, i: Inspection) => void;
  deleteInspection: (index: number) => void;
};

const InspectionsContext = createContext<InspectionsContextValue | undefined>(undefined);

export function InspectionsProvider({ children }: { children: React.ReactNode }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/inspections", { cache: "no-store" });
      const data = await res.json();
      setInspections(data);
    })();
  }, []);

  const addInspection = async (i: Inspection) => {
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(i),
    });
    const created = await res.json();
    setInspections((prev) => [...prev, created]);
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
  };

  const deleteInspection = async (index: number) => {
    const id = inspections[index]?.id;
    if (!id) return;
    await fetch(`/api/inspections/${id}`, { method: "DELETE" });
    setInspections((prev) => prev.filter((_, idx) => idx !== index));
  };

  const value = useMemo(
    () => ({ inspections, addInspection, updateInspection, deleteInspection }),
    [inspections]
  );

  return <InspectionsContext.Provider value={value}>{children}</InspectionsContext.Provider>;
}

export function useInspections() {
  const ctx = useContext(InspectionsContext);
  if (!ctx) throw new Error("useInspections must be used within InspectionsProvider");
  return ctx;
}
