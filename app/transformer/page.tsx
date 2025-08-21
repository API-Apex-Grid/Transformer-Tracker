"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddTransformerModal from "@/components/AddTransformerModal";
import TransformerList from "@/components/TransformerList";
import EditTransformerModal from "@/components/EditTransformerModal";
import TransformerDetailsPanel from "@/components/TransformerDetailsPanel";
import InspectionsList from "@/components/InspectionsList";
import AddInspectionModal from "@/components/AddInspectionModal";
import EditInspectionModal from "@/components/EditInspectionModal";
import { Transformer } from "@/types/transformer";
import { Inspection } from "@/types/inspection";
import { useTransformers } from "@/context/TransformersContext";
import { useInspections } from "@/context/InspectionsContext";

const TransformerPage = () => {
  const { transformers, addTransformer: addFromCtx, updateTransformer, deleteTransformer: deleteFromCtx } = useTransformers();
  const { inspections, addInspection: addInspectionCtx, updateInspection, deleteInspection } = useInspections();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewingTransformer, setViewingTransformer] = useState<Transformer | null>(null);
  const [isEditInspectionOpen, setIsEditInspectionOpen] = useState(false);
  const [editingInspectionIndex, setEditingInspectionIndex] = useState<number | null>(null);

  const router = useRouter();

  useEffect(() => {
    try {
      const loggedIn = typeof window !== 'undefined' && localStorage.getItem("isLoggedIn") === "true";
      if (!loggedIn) {
        router.replace("/");
      }
    } catch {
      router.replace("/");
    }
  }, [router]);

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

  const openView = (index: number) => {
    setViewingTransformer(transformers[index]);
  };

  const closeView = () => {
    setViewingTransformer(null);
  };

  const getRelatedInspections = (transformerNumber: string) => {
    return inspections.filter(inspection => inspection.transformerNumber === transformerNumber);
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
    const relatedInspections = getRelatedInspections(viewingTransformer!.transformerNumber);
    const originalIndex = inspections.findIndex(inspection =>
      inspection.inspectionNumber === relatedInspections[editingInspectionIndex].inspectionNumber
    );
    if (originalIndex !== -1) {
      updateInspection(originalIndex, updated);
    }
  };

  const deleteInspectionHandler = (index: number) => {
    if (!viewingTransformer) return;
    const relatedInspections = getRelatedInspections(viewingTransformer.transformerNumber);
    const originalIndex = inspections.findIndex(inspection =>
      inspection.inspectionNumber === relatedInspections[index].inspectionNumber
    );
    if (originalIndex !== -1) {
      deleteInspection(originalIndex);
    }
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        {viewingTransformer ? (
          <h1 className="text-2xl font-bold">Transformer {viewingTransformer.transformerNumber}</h1>
        ) : (
          <h1 className="text-2xl font-bold">All Transformers</h1>
        )}
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => {
              try {
                localStorage.removeItem("isLoggedIn");
              } catch { }
              router.replace("/");
            }}
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
          >
            Log out
          </button>
          {!viewingTransformer && (
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                className="px-4 py-2 rounded-md bg-black text-white font-medium"
              >
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

      {!viewingTransformer && <AddTransformerModal addTransformer={addTransformer} />}

      {viewingTransformer && (
        <TransformerDetailsPanel
          transformer={viewingTransformer}
          onClose={closeView}
        />
      )}

      {viewingTransformer ? (
        <>
          <h1 className="text-xl font-bold mb-4">Transformer Inspections</h1>
          <AddInspectionModal
            addInspection={addInspection}
            prefilledTransformerNumber={viewingTransformer.transformerNumber}
          />
          <InspectionsList
            inspections={getRelatedInspections(viewingTransformer.transformerNumber)}
            hideTransformerColumn={true}
            onEdit={openEditInspection}
            onDelete={deleteInspectionHandler}
          />
        </>
      ) : (
        <TransformerList
          transformers={transformers}
          onEdit={openEdit}
          onDelete={deleteTransformer}
          onView={openView}
        />
      )}

      <EditTransformerModal
        isOpen={isEditOpen}
        initial={editingIndex !== null ? transformers[editingIndex] : null}
        onClose={closeEdit}
        onSave={saveEdit}
      />
      <EditInspectionModal
        isOpen={isEditInspectionOpen}
        initial={editingInspectionIndex !== null && viewingTransformer ?
          getRelatedInspections(viewingTransformer.transformerNumber)[editingInspectionIndex] : null}
        onClose={closeEditInspection}
        onSave={saveEditInspection}
      />
    </div>
  );
};

export default TransformerPage;
