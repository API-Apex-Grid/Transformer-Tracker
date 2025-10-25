"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import TransformerDetailsPanel from "@/components/TransformerDetailsPanel";
import InspectionsList from "@/components/InspectionsList";
import AddInspectionModal from "@/components/AddInspectionModal";
import EditInspectionModal from "@/components/EditInspectionModal";
import LoadingScreen from "@/components/LoadingScreen";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { useTransformers } from "@/context/TransformersContext";
import { useInspections } from "@/context/InspectionsContext";
import { Transformer } from "@/types/transformer";
import { Inspection } from "@/types/inspection";

const TransformerDetailPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const {
    transformers,
    fetchTransformerById,
    updateTransformer,
  } = useTransformers();
  const {
    inspections,
    addInspection,
    updateInspection,
    deleteInspection,
    loading: inspectionsLoading,
    fetchInspectionById,
  } = useInspections();

  const [transformer, setTransformer] = useState<Transformer | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [profileSrc, setProfileSrc] = useState<string>("/avatar.png");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading transformer...");
  const [notFound, setNotFound] = useState(false);

  const [isEditInspectionOpen, setIsEditInspectionOpen] = useState(false);
  const [editingInspectionIndex, setEditingInspectionIndex] = useState<number | null>(null);

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

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!rawId) {
        if (active) {
          setTransformer(null);
          setNotFound(true);
          setIsLoading(false);
        }
        return;
      }
      setIsLoading(true);
  setLoadingMessage("Loading transformer...");
      setNotFound(false);
      const existing = transformers.find((candidate) => {
        if (candidate.id && candidate.id === rawId) return true;
        return candidate.transformerNumber === rawId;
      });
      let resolved: Transformer | null = existing ?? null;
      const targetId = existing?.id ?? rawId;
      try {
        const fetched = await fetchTransformerById(targetId);
        if (fetched) {
          resolved = fetched;
        }
      } catch {
        // ignore fetch failures, we will fall back to existing data
      }
      if (!resolved) {
        if (active) {
          setTransformer(null);
          setNotFound(true);
        }
      } else if (active) {
        setTransformer(resolved);
      }
      if (active) {
        setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [rawId, transformers, fetchTransformerById]);

  const relatedInspections = useMemo(() => {
    if (!transformer) return [] as Inspection[];
    return inspections.filter(
      (inspection) => inspection.transformerNumber === transformer.transformerNumber
    );
  }, [inspections, transformer]);

  const openEditInspection = (index: number) => {
    const item = relatedInspections[index];
    if (!item) return;
    const contextIndex = inspections.findIndex((candidate) => {
      if (item.id && candidate.id) return candidate.id === item.id;
      return candidate.inspectionNumber === item.inspectionNumber;
    });
    if (contextIndex === -1) return;
    setEditingInspectionIndex(contextIndex);
    setIsEditInspectionOpen(true);
  };

  const closeEditInspection = () => {
    setIsEditInspectionOpen(false);
    setEditingInspectionIndex(null);
  };

  const saveEditInspection = (updated: Inspection) => {
    if (editingInspectionIndex === null) return;
    updateInspection(editingInspectionIndex, updated);
  };

  const deleteInspectionHandler = (index: number) => {
    const item = relatedInspections[index];
    if (!item) return;
    const contextIndex = inspections.findIndex((candidate) => {
      if (item.id && candidate.id) return candidate.id === item.id;
      return candidate.inspectionNumber === item.inspectionNumber;
    });
    if (contextIndex === -1) return;
    deleteInspection(contextIndex);
  };

  const openViewInspection = async (index: number) => {
    const item = relatedInspections[index];
    if (!item) return;
    if (item.id) {
      router.push(`/inspections/${item.id}`);
      return;
    }
    // If summary is missing id, try to resolve via API to discover its identifier
    try {
      const fetched = item.inspectionNumber ? await fetchInspectionById(item.inspectionNumber) : null;
      const navId = fetched?.id ?? item.inspectionNumber;
      router.push(`/inspections/${encodeURIComponent(navId ?? "")}`);
    } catch {
      router.push(`/inspections/${encodeURIComponent(item.inspectionNumber)}`);
    }
  };

  const handleUpdateTransformer = (updated: Transformer) => {
    setTransformer(updated);
    const contextIndex = transformers.findIndex((candidate) => {
      if (updated.id && candidate.id) return candidate.id === updated.id;
      return candidate.transformerNumber === updated.transformerNumber;
    });
    if (contextIndex !== -1) {
      updateTransformer(contextIndex, updated);
    }
  };

  const handleAddInspection = (inspection: Inspection) => {
    addInspection(inspection);
  };

  if (notFound && !isLoading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Logo width={36} height={36} />
          <span
            className="font-semibold text-2xl tracking-wider"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            APEX-GRID
          </span>
        </div>
        <p className="text-lg font-semibold text-gray-700">Transformer not found.</p>
        <button
          onClick={() => router.push("/transformer")}
          className="custombutton inline-flex items-center px-4 py-2 rounded"
        >
          Back to transformers
        </button>
      </div>
    );
  }

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/transformer")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to transformers
              </button>
            </div>
            {transformer && (
              <h1 className="text-2xl font-bold">
                Transformer {transformer.transformerNumber}
              </h1>
            )}
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
                onClick={() => {
                  try {
                    localStorage.removeItem("isLoggedIn");
                    localStorage.removeItem("username");
                    localStorage.removeItem("userImage");
                    localStorage.removeItem("token");
                    localStorage.removeItem("tokenExpiresAt");
                  } catch {}
                  router.replace("/");
                }}
                className="inline-flex items-center rounded-md px-4 py-2 custombutton"
              >
                Log out
              </button>
            </div>
          </div>
        </div>

        {transformer && (
          <TransformerDetailsPanel
            transformer={transformer}
            onClose={() => router.back()}
            onUpdateTransformer={handleUpdateTransformer}
          />
        )}

        {transformer && (
          <>
            <h2 className="text-xl font-bold mb-4">Transformer Inspections</h2>
            <AddInspectionModal
              addInspection={handleAddInspection}
              prefilledTransformerNumber={transformer.transformerNumber}
            />
            <InspectionsList
              inspections={relatedInspections}
              hideTransformerColumn={true}
              onEdit={openEditInspection}
              onDelete={deleteInspectionHandler}
              onView={openViewInspection}
            />
          </>
        )}

        <EditInspectionModal
          isOpen={isEditInspectionOpen}
          initial={
            editingInspectionIndex !== null
              ? inspections[editingInspectionIndex]
              : null
          }
          onClose={closeEditInspection}
          onSave={saveEditInspection}
        />
      </div>
      <LoadingScreen
        show={isLoading || inspectionsLoading}
  message={loadingMessage || "Loading data..."}
      />
    </>
  );
};

export default TransformerDetailPage;
