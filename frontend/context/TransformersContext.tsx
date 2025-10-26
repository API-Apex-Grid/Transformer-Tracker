"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Transformer } from "@/types/transformer";
import { apiUrl, authHeaders } from "@/lib/api";
import { dispatchTransformerRemoved } from "@/lib/events";

type TransformersContextValue = {
  transformers: Transformer[];
  addTransformer: (t: Transformer) => void;
  updateTransformer: (index: number, t: Transformer) => void;
  deleteTransformer: (index: number) => void;
  reload: () => Promise<void>;
  lastError: string | null;
  loading: boolean;
  fetchTransformerById: (id: string) => Promise<Transformer | null>;
  findByNumber: (transformerNumber: string) => Transformer | undefined;
};

const TransformersContext = createContext<TransformersContextValue | undefined>(undefined);

export function TransformersProvider({ children }: { children: React.ReactNode }) {
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // load from API
  const load = async () => {
    try {
      setLastError(null);
      setLoading(true);
      // Ask the local API for summary only to reduce payload
      const res = await fetch("/api/transformers?summary=1", {
        cache: "no-store",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend responded ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
      }
      const data = await res.json();
      const list: Transformer[] = Array.isArray(data) ? data : [];
      const numKey = (s: string | undefined) => {
        if (!s) return Number.POSITIVE_INFINITY;
        const m = s.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
      };
      list.sort((a, b) => {
        const na = numKey(a.transformerNumber);
        const nb = numKey(b.transformerNumber);
        if (na !== nb) return na - nb;
        return (a.transformerNumber || '').localeCompare(b.transformerNumber || '');
      });
      setTransformers(list as Transformer[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error fetching transformers';
      console.error('[TransformersContext] load failed:', err);
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

  // Reload when app signals login or when window regains focus while logged in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onLoggedIn = () => { void load(); };
    const onFocus = () => {
      try {
        const logged = localStorage.getItem('isLoggedIn') === 'true';
        if (logged) void load();
      } catch { /* ignore */ }
    };
    window.addEventListener('app:logged-in', onLoggedIn as EventListener);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('app:logged-in', onLoggedIn as EventListener);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Do not refetch on route change; list is cached in memory and can be refreshed explicitly

  const fetchTransformerById = async (id: string): Promise<Transformer | null> => {
    try {
      const res = await fetch(`/api/transformers/${id}`, {
        cache: 'no-store',
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const t = await res.json();
      return t as Transformer;
    } catch {
      return null;
    }
  };

  const findByNumber = (transformerNumber: string) => transformers.find(t => t.transformerNumber === transformerNumber);

  const addTransformer = async (t: Transformer) => {
    let username: string | null = null;
    try { username = typeof window !== 'undefined' ? localStorage.getItem('username') : null; } catch {}
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...authHeaders(),
    };
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
      headers,
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
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    const updated = await res.json();
    setTransformers((prev) => prev.map((it, i) => (i === index ? updated : it)));
  void load();
  };

  const deleteTransformer = async (index: number) => {
    const transformer = transformers[index];
    if (!transformer) return;
    const id = transformer.id ?? null;
    const transformerNumber = transformer.transformerNumber ?? null;

    if (!id) {
      setTransformers((prev) => prev.filter((_, i) => i !== index));
      dispatchTransformerRemoved({ id, transformerNumber });
      return;
    }
    const res = await fetch(apiUrl(`/api/transformers/${id}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const message = (await res.json().catch(() => ({}))) as { error?: string };
      const errorText = message?.error || `Failed to delete transformer (${res.status})`;
      console.error("[TransformersContext] delete failed:", errorText);
      setLastError(errorText);
      return;
    }
    setLastError(null);
    setTransformers((prev) =>
      prev.filter((item) => {
        if (id) {
          if (item.id) return item.id !== id;
          // Fallback to transformerNumber if id is missing locally
          return item.transformerNumber !== transformerNumber;
        }
        return item.transformerNumber !== transformerNumber;
      })
    );
    dispatchTransformerRemoved({ id, transformerNumber });
  };

  const value = useMemo(
    () => ({ transformers, addTransformer, updateTransformer, deleteTransformer, reload: load, lastError, loading, fetchTransformerById, findByNumber }),
    [transformers, lastError, loading]
  );

  return <TransformersContext.Provider value={value}>{children}</TransformersContext.Provider>;
}

export function useTransformers() {
  const ctx = useContext(TransformersContext);
  if (!ctx) throw new Error("useTransformers must be used within TransformersProvider");
  return ctx;
}
