"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Transformer } from "@/types/transformer";

type TransformersContextValue = {
  transformers: Transformer[];
  addTransformer: (t: Transformer) => void;
  updateTransformer: (index: number, t: Transformer) => void;
  deleteTransformer: (index: number) => void;
};

const TransformersContext = createContext<TransformersContextValue | undefined>(undefined);

export function TransformersProvider({ children }: { children: React.ReactNode }) {
  const [transformers, setTransformers] = useState<Transformer[]>([]);

  // load from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem("transformers");
      if (raw) setTransformers(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  // persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("transformers", JSON.stringify(transformers));
    } catch { /* noop */ }
  }, [transformers]);

  const addTransformer = (t: Transformer) => setTransformers((prev) => [...prev, t]);
  const updateTransformer = (index: number, t: Transformer) =>
    setTransformers((prev) => prev.map((it, i) => (i === index ? t : it)));
  const deleteTransformer = (index: number) =>
    setTransformers((prev) => prev.filter((_, i) => i !== index));

  const value = useMemo(
    () => ({ transformers, addTransformer, updateTransformer, deleteTransformer }),
    [transformers]
  );

  return <TransformersContext.Provider value={value}>{children}</TransformersContext.Provider>;
}

export function useTransformers() {
  const ctx = useContext(TransformersContext);
  if (!ctx) throw new Error("useTransformers must be used within TransformersProvider");
  return ctx;
}
