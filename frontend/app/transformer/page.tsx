"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AddTransformerModal from "@/components/AddTransformerModal";
import TransformerList from "@/components/TransformerList";
import EditTransformerModal from "@/components/EditTransformerModal";
import TransformerDetailsPanel from "@/components/TransformerDetailsPanel";
import InspectionsList from "@/components/InspectionsList";
import AddInspectionModal from "@/components/AddInspectionModal";
import EditInspectionModal from "@/components/EditInspectionModal";
import InspectionDetailsPanel from "@/components/InspectionDetailsPanel";
import { Transformer } from "@/types/transformer";
import { Inspection } from "@/types/inspection";
import { useTransformers } from "@/context/TransformersContext";
import { useInspections } from "@/context/InspectionsContext";
import LoadingScreen from "@/components/LoadingScreen";

const TransformerPage = () => {
  const {
    transformers,
    addTransformer: addFromCtx,
    updateTransformer,
    deleteTransformer: deleteFromCtx,
    fetchTransformerById,
    reload: reloadTransformersList,
  } = useTransformers();
  const {
    inspections,
    addInspection: addInspectionCtx,
    updateInspection,
    deleteInspection,
    fetchInspectionById,
    reload: reloadInspectionsList,
  } = useInspections();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewingTransformer, setViewingTransformer] =
    useState<Transformer | null>(null);
  const [isEditInspectionOpen, setIsEditInspectionOpen] = useState(false);
  const [editingInspectionIndex, setEditingInspectionIndex] = useState<
    number | null
  >(null);
  const [viewingInspection, setViewingInspection] = useState<Inspection | null>(
    null
  );
  const [username, setUsername] = useState<string | null>(null);
  // Keep avatar src consistent between SSR and first client render; update after mount
  const [profileSrc, setProfileSrc] = useState<string>("/avatar.png");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");

  // Filters for the main Transformers list view
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
      // Load summary lists on first entry after login
      if (loggedIn && transformers.length === 0) {
        void reloadTransformersList();
      }
      if (loggedIn && inspections.length === 0) {
        void reloadInspectionsList();
      }
    } catch {
      router.replace("/");
    }
  }, [router, transformers.length, inspections.length, reloadTransformersList, reloadInspectionsList]);

  const addTransformer = (transformer: Transformer) => {
    addFromCtx(transformer);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
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
    deleteFromCtx(index);
  };

  const openView = async (index: number) => {
    const item = transformers[index];
    if (!item) return;
    try {
      setLoadingMessage("Loading transformer…");
      setIsLoading(true);
      const full = item.id ? await fetchTransformerById(item.id) : null;
      setViewingTransformer(full || item);
    } finally {
      setIsLoading(false);
    }
  };

  const closeView = () => {
    setViewingTransformer(null);
  };

  const getRelatedInspections = (transformerNumber: string) => {
    return inspections.filter(
      (inspection) => inspection.transformerNumber === transformerNumber
    );
  };

  const addInspection = (inspection: Inspection) => {
    addInspectionCtx(inspection);
  };

  const openEditInspection = (index: number) => {
    setEditingInspectionIndex(index);
    setIsEditInspectionOpen(true);
  };

  const closeEditInspection = () => {
    setIsEditInspectionOpen(false);
    setEditingInspectionIndex(null);
  };

  const saveEditInspection = (updated: Inspection) => {
    if (editingInspectionIndex === null) return;
    const relatedInspections = getRelatedInspections(
      viewingTransformer!.transformerNumber
    );
    const originalIndex = inspections.findIndex(
      (inspection) =>
        inspection.inspectionNumber ===
        relatedInspections[editingInspectionIndex].inspectionNumber
    );
    if (originalIndex !== -1) {
      updateInspection(originalIndex, updated);
    }
  };

  const deleteInspectionHandler = (index: number) => {
    if (!viewingTransformer) return;
    const relatedInspections = getRelatedInspections(
      viewingTransformer.transformerNumber
    );
    const originalIndex = inspections.findIndex(
      (inspection) =>
        inspection.inspectionNumber ===
        relatedInspections[index].inspectionNumber
    );
    if (originalIndex !== -1) {
      deleteInspection(originalIndex);
    }
  };

  const openViewInspection = async (index: number) => {
    if (!viewingTransformer) return;
    const relatedInspections = getRelatedInspections(
      viewingTransformer.transformerNumber
    );
    const item = relatedInspections[index];
    if (!item) return;
    try {
      setLoadingMessage("Loading inspection…");
      setIsLoading(true);
      const originalIndex = inspections.findIndex(
        (inspection) => inspection.inspectionNumber === item.inspectionNumber
      );
      const byId = originalIndex >= 0 ? inspections[originalIndex]?.id : item.id;
      const full = byId ? await fetchInspectionById(byId) : null;
      setViewingInspection(full || item);
    } finally {
      setIsLoading(false);
    }
  };

  const closeViewInspection = () => {
    setViewingInspection(null);
  };

  const updateViewingTransformer = (updatedTransformer: Transformer) => {
    // Find the index of the transformer being viewed
    const index = transformers.findIndex(
      (t) => t.transformerNumber === updatedTransformer.transformerNumber
    );
    if (index !== -1) {
      // Update the transformer in the context
      updateTransformer(index, updatedTransformer);
      // Update the local viewing state
      setViewingTransformer(updatedTransformer);
    }
  };

  // Build dropdown options from existing data
  const regionOptions = Array.from(
    new Set(transformers.map((t) => t.region))
  ).sort();
  const typeOptions = Array.from(
    new Set(transformers.map((t) => t.type))
  ).sort();

  const filteredTransformers = transformers.filter((t) => {
    const matchesTf =
      tfNumberQuery.trim() === "" ||
      t.transformerNumber.toLowerCase().includes(tfNumberQuery.toLowerCase());
    const matchesPole =
      poleQuery.trim() === "" ||
      t.poleNumber.toLowerCase().includes(poleQuery.toLowerCase());
    const matchesRegion = regionFilter === "" || t.region === regionFilter;
    const matchesType = typeFilter === "" || t.type === typeFilter;
    const matchesFav = !favOnly || !!t.favourite;
    return matchesTf && matchesPole && matchesRegion && matchesType && matchesFav;
  });

  const initialListsLoading = transformers.length === 0 && inspections.length === 0;

  return (
    <>
    <div className="p-4 pb-24">
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-3">
            <Image src="/transformer.png" alt="Apex Grid" width={36} height={36} />
            <span className="font-semibold text-2xl tracking-wider" style={{ fontFamily: 'var(--font-orbitron)' }}>APEX-GRID</span>
          </div>
          {viewingInspection ? (
            <h1 className="text-2xl font-bold">
              Inspection {viewingInspection.inspectionNumber}
            </h1>
          ) : viewingTransformer ? (
            <h1 className="text-2xl font-bold">
              Transformer {viewingTransformer.transformerNumber}
            </h1>
          ) : (
            <h1 className="text-2xl font-bold">All Transformers</h1>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              Logged in as: <span className="font-medium">{username || "unknown"}</span>
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
              onClick={() => {
                try {
                  localStorage.removeItem("isLoggedIn");
                  localStorage.removeItem("username");
                  localStorage.removeItem("userImage");
                } catch {}
                router.replace("/");
              }}
              className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
            >
              Log out
            </button>
          </div>
          {!viewingTransformer && !viewingInspection && (
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button className="px-4 py-2 rounded-md bg-black text-white font-medium">
                Transformers
              </button>
              <button
                onClick={() => router.push("/inspections")}
                className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-300 font-medium"
              >
                Inspections
              </button>
            </div>
          )}
        </div>
      </div>

      {!viewingTransformer && (
        <AddTransformerModal addTransformer={addTransformer} />
      )}

      {/* Filters for Transformers main list */}
      {!viewingTransformer && !viewingInspection && (
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
            <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
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
      )}

      {viewingTransformer && !viewingInspection && (
        <TransformerDetailsPanel
          transformer={viewingTransformer}
          onClose={closeView}
          onUpdateTransformer={updateViewingTransformer}
        />
      )}

      {viewingInspection && (
        <InspectionDetailsPanel
          inspection={viewingInspection}
          onClose={closeViewInspection}
        />
      )}

      {viewingTransformer && !viewingInspection ? (
        <>
          <h1 className="text-xl font-bold mb-4">Transformer Inspections</h1>
          <AddInspectionModal
            addInspection={addInspection}
            prefilledTransformerNumber={viewingTransformer.transformerNumber}
          />
          <InspectionsList
            inspections={getRelatedInspections(
              viewingTransformer.transformerNumber
            )}
            hideTransformerColumn={true}
            onEdit={openEditInspection}
            onDelete={deleteInspectionHandler}
            onView={openViewInspection}
          />
        </>
      ) : !viewingInspection ? (
        <TransformerList
          transformers={filteredTransformers}
          onEdit={openEdit}
          onDelete={deleteTransformer}
          onView={openView}
        />
      ) : null}

      <EditTransformerModal
        isOpen={isEditOpen}
        initial={editingIndex !== null ? transformers[editingIndex] : null}
        onClose={closeEdit}
        onSave={saveEdit}
      />
      <EditInspectionModal
        isOpen={isEditInspectionOpen}
        initial={
          editingInspectionIndex !== null && viewingTransformer
            ? getRelatedInspections(viewingTransformer.transformerNumber)[
                editingInspectionIndex
              ]
            : null
        }
        onClose={closeEditInspection}
        onSave={saveEditInspection}
      />
    </div>
    <LoadingScreen show={isLoading || initialListsLoading} message={loadingMessage || (initialListsLoading ? "Loading data…" : "Loading…")} />
    </>
  );
};

export default TransformerPage;
