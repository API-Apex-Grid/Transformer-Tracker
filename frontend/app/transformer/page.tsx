"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AddTransformerModal from "@/components/AddTransformerModal";
import TransformerList from "@/components/TransformerList";
import EditTransformerModal from "@/components/EditTransformerModal";
import { Transformer } from "@/types/transformer";
import { useTransformers } from "@/context/TransformersContext";
import LoadingScreen from "@/components/LoadingScreen";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { clearClientSession } from "@/lib/auth";

const TransformerPage = () => {
  const {
    transformers,
    addTransformer: addFromCtx,
    updateTransformer,
    deleteTransformer: deleteFromCtx,
    loading: transformersLoading,
  } = useTransformers();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  // Preserve avatar between SSR and first client render
  const [profileSrc, setProfileSrc] = useState<string>("/avatar.png");

  // Filters for the transformers table
  const [tfNumberQuery, setTfNumberQuery] = useState("");
  const [poleQuery, setPoleQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const router = useRouter();

  useEffect(() => {
    try {
      const loggedIn =
        typeof window !== "undefined" &&
        localStorage.getItem("isLoggedIn") === "true";
      if (!loggedIn) {
        router.replace("/");
      }
      if (typeof window !== "undefined") {
        setUsername(localStorage.getItem("username"));
        const stored = localStorage.getItem("userImage");
        if (stored && stored.length > 0) {
          setProfileSrc(stored);
        }
      }
    } catch {
      router.replace("/");
    }
  }, [router]);

  const addTransformer = (transformer: Transformer) => {
    addFromCtx(transformer);
  };

  const openEdit = (index: number) => {
    const item = filteredTransformers[index];
    if (!item) return;
    const contextIndex = transformers.findIndex((candidate) => {
      if (item.id && candidate.id) return candidate.id === item.id;
      return candidate.transformerNumber === item.transformerNumber;
    });
    if (contextIndex === -1) return;
    setEditingIndex(contextIndex);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingIndex(null);
  };

  const saveEdit = (updated: Transformer) => {
    if (editingIndex === null) return;
    updateTransformer(editingIndex, updated);
  };

  const deleteTransformer = (index: number) => {
    const item = filteredTransformers[index];
    if (!item) return;
    const contextIndex = transformers.findIndex((candidate) => {
      if (item.id && candidate.id) return candidate.id === item.id;
      return candidate.transformerNumber === item.transformerNumber;
    });
    if (contextIndex === -1) return;
    deleteFromCtx(contextIndex);
  };

  const openView = (index: number) => {
    const item = filteredTransformers[index];
    if (!item) return;
    const identifier = item.id ?? encodeURIComponent(item.transformerNumber);
    router.push(`/transformer/${identifier}`);
  };

  const regionOptions = useMemo(
    () => Array.from(new Set(transformers.map((t) => t.region))).sort(),
    [transformers]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(transformers.map((t) => t.type))).sort(),
    [transformers]
  );

  const filteredTransformers = useMemo(() => {
    return transformers.filter((t) => {
      const matchesTf =
        tfNumberQuery.trim() === "" ||
        t.transformerNumber.toLowerCase().includes(tfNumberQuery.toLowerCase());
      const matchesPole =
        poleQuery.trim() === "" ||
        t.poleNumber.toLowerCase().includes(poleQuery.toLowerCase());
      const matchesRegion = regionFilter === "" || t.region === regionFilter;
      const matchesType = typeFilter === "" || t.type === typeFilter;
      const matchesFav = !favOnly || !!t.favourite;
      return (
        matchesTf && matchesPole && matchesRegion && matchesType && matchesFav
      );
    });
  }, [transformers, tfNumberQuery, poleQuery, regionFilter, typeFilter, favOnly]);

  return (
    <>
      <div className="p-4 pb-24">
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-3">
              <Logo width={36} height={36} />
              <span
                className="font-semibold text-2xl tracking-wider"
                style={{ fontFamily: "var(--font-orbitron)" }}
              >
                APEX-GRID
              </span>
            </div>
            <h1 className="text-2xl font-bold">All Transformers</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-gray-700">
                Logged in as:{" "}
                <span className="font-medium">{username || "unknown"}</span>
              </span>
              <button
                onClick={() => router.push("/profile")}
                className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 border hover:ring-2 hover:ring-gray-300"
                title="Profile Settings"
              >
                <Image
                  src={profileSrc}
                  alt="Profile"
                  width={32}
                  height={32}
                  loading="lazy"
                  unoptimized={profileSrc.startsWith("data:")}
                  className="w-full h-full object-cover"
                />
              </button>
              <button
                onClick={async () => {
                  await clearClientSession();
                  router.replace("/");
                }}
                className="inline-flex items-center rounded-md px-4 py-2 custombutton"
              >
                Log out
              </button>
            </div>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button className="px-4 py-2 rounded-md disabledbutton font-medium mr-1">
                Transformers
              </button>
              <button
                onClick={() => router.push("/inspections")}
                className="px-4 py-2 rounded-md custombutton font-medium ml-1"
              >
                Inspections
              </button>
            </div>
          </div>
        </div>

        <AddTransformerModal addTransformer={addTransformer} />

        <div className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            value={tfNumberQuery}
            onChange={(e) => setTfNumberQuery(e.target.value)}
            placeholder="Search transformer no."
            className="px-3 py-2 border rounded-md"
          />
          <input
            value={poleQuery}
            onChange={(e) => setPoleQuery(e.target.value)}
            placeholder="Search pole no."
            className="px-3 py-2 border rounded-md"
          />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">All regions</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-black px-3 py-2">
            <input
              type="checkbox"
              checked={favOnly}
              onChange={(e) => setFavOnly(e.target.checked)}
            />
            Favourites
          </label>
          <button
            onClick={() => {
              setTfNumberQuery("");
              setPoleQuery("");
              setRegionFilter("");
              setTypeFilter("");
              setFavOnly(false);
            }}
            className="px-3 py-2 border rounded-md bg-gray-100 hover:bg-gray-200"
          >
            Clear
          </button>
        </div>

        <TransformerList
          transformers={filteredTransformers}
          onEdit={openEdit}
          onDelete={deleteTransformer}
          onView={openView}
        />

        <EditTransformerModal
          isOpen={isEditOpen}
          initial={editingIndex !== null ? transformers[editingIndex] : null}
          onClose={closeEdit}
          onSave={saveEdit}
        />
      </div>
  <LoadingScreen show={transformersLoading} message="Loading data..." />
    </>
  );
};

export default TransformerPage;
