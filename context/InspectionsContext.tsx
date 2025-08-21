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
    try {
      const raw = localStorage.getItem("inspections");
      if (raw) setInspections(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("inspections", JSON.stringify(inspections));
    } catch {}
  }, [inspections]);

  const addInspection = (i: Inspection) => setInspections((prev) => [...prev, i]);
  const updateInspection = (index: number, i: Inspection) =>
    setInspections((prev) => prev.map((it, idx) => (idx === index ? i : it)));
  const deleteInspection = (index: number) =>
    setInspections((prev) => prev.filter((_, idx) => idx !== index));

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
