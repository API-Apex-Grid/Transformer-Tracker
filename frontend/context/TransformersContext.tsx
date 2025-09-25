"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Transformer } from "@/types/transformer";
import { apiUrl } from "@/lib/api";

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
    const res = await fetch(apiUrl("/api/transformers"), { cache: "no-store" });
    const data = await res.json();
    setTransformers(data);
  };

  // Initial load
  useEffect(() => {
    void load();
  }, []);

  // Refetch on route change (e.g., switching between /transformer and /inspections)
  useEffect(() => {
    if (!pathname) return;
    void load();
  }, [pathname]);

  const addTransformer = async (t: Transformer) => {
    let username: string | null = null;
    try { username = typeof window !== 'undefined' ? localStorage.getItem('username') : null; } catch {}
    const now = new Date().toISOString();
    const body: Partial<Transformer> = {
      ...t,
      uploadedBy: username,
      sunnyImageUploadedBy: t.sunnyImage ? username : undefined,
      cloudyImageUploadedBy: t.cloudyImage ? username : undefined,
      windyImageUploadedBy: t.windyImage ? username : undefined,
      sunnyImageUploadedAt: t.sunnyImage ? now : undefined,
      cloudyImageUploadedAt: t.cloudyImage ? now : undefined,
      windyImageUploadedAt: t.windyImage ? now : undefined,
    };
  const res = await fetch(apiUrl("/api/transformers"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const created = await res.json();
    setTransformers((prev) => [...prev, created]);
  void load();
  };

  const updateTransformer = async (index: number, t: Transformer) => {
    const id = transformers[index]?.id;
    if (!id) return;
    // Attribute image uploader when images are added/updated/removed
    let username: string | null = null;
    try { username = typeof window !== 'undefined' ? localStorage.getItem('username') : null; } catch {}
    const current = transformers[index];
  const body: Partial<Transformer & { [k: string]: unknown }> = { ...t };
    const nowIso = new Date().toISOString();
  if (Object.prototype.hasOwnProperty.call(t, 'sunnyImage') && current) {
      if (t.sunnyImage !== current.sunnyImage) {
  (body as Record<string, unknown>).sunnyImageUploadedBy = t.sunnyImage ? username : null;
  (body as Record<string, unknown>).sunnyImageUploadedAt = t.sunnyImage ? nowIso : null;
      }
    }
  if (Object.prototype.hasOwnProperty.call(t, 'cloudyImage') && current) {
      if (t.cloudyImage !== current.cloudyImage) {
  (body as Record<string, unknown>).cloudyImageUploadedBy = t.cloudyImage ? username : null;
  (body as Record<string, unknown>).cloudyImageUploadedAt = t.cloudyImage ? nowIso : null;
      }
    }
  if (Object.prototype.hasOwnProperty.call(t, 'windyImage') && current) {
      if (t.windyImage !== current.windyImage) {
  (body as Record<string, unknown>).windyImageUploadedBy = t.windyImage ? username : null;
  (body as Record<string, unknown>).windyImageUploadedAt = t.windyImage ? nowIso : null;
      }
    }

  const res = await fetch(apiUrl(`/api/transformers/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const updated = await res.json();
    setTransformers((prev) => prev.map((it, i) => (i === index ? updated : it)));
  void load();
  };

  const deleteTransformer = async (index: number) => {
    const id = transformers[index]?.id;
    if (!id) return;
  await fetch(apiUrl(`/api/transformers/${id}`), { method: "DELETE" });
    setTransformers((prev) => prev.filter((_, i) => i !== index));
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
