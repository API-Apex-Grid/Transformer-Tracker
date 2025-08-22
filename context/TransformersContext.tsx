"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Transformer } from "@/types/transformer";

type TransformersContextValue = {
  transformers: Transformer[];
  addTransformer: (t: Transformer) => void;
  updateTransformer: (index: number, t: Transformer) => void;
  deleteTransformer: (index: number) => void;
  reload: () => Promise<void>;
};

const TransformersContext = createContext<TransformersContextValue | undefined>(undefined);

export function TransformersProvider({ children }: { children: React.ReactNode }) {
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const pathname = usePathname();

  // load from API
  const load = async () => {
    const res = await fetch("/api/transformers", { cache: "no-store" });
    const data = await res.json();
    setTransformers(data);
  };

  // Initial load
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch on route change (e.g., switching between /transformer and /inspections)
  useEffect(() => {
    if (!pathname) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const addTransformer = async (t: Transformer) => {
    const res = await fetch("/api/transformers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    const created = await res.json();
    setTransformers((prev) => [...prev, created]);
  // Ensure state matches DB in case of server-side defaults/hooks
  void load();
  };

  const updateTransformer = async (index: number, t: Transformer) => {
    const id = transformers[index]?.id;
    if (!id) return;
    const res = await fetch(`/api/transformers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    const updated = await res.json();
    setTransformers((prev) => prev.map((it, i) => (i === index ? updated : it)));
  // Keep in sync with DB
  void load();
  };

  const deleteTransformer = async (index: number) => {
    const id = transformers[index]?.id;
    if (!id) return;
    await fetch(`/api/transformers/${id}`, { method: "DELETE" });
    setTransformers((prev) => prev.filter((_, i) => i !== index));
  // Cascade deletes may affect related data; refresh to reflect truth from DB
  void load();
  };

  const value = useMemo(
    () => ({ transformers, addTransformer, updateTransformer, deleteTransformer, reload: load }),
    [transformers]
  );

  return <TransformersContext.Provider value={value}>{children}</TransformersContext.Provider>;
}

export function useTransformers() {
  const ctx = useContext(TransformersContext);
  if (!ctx) throw new Error("useTransformers must be used within TransformersProvider");
  return ctx;
}
