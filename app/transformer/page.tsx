"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddTransformerModal from "@/components/AddTransformerModal";
import TransformerList from "@/components/TransformerList";
import EditTransformerModal from "@/components/EditTransformerModal";
import TransformerDetailsPanel from "@/components/TransformerDetailsPanel";
import { Transformer } from "@/types/transformer";
import { useTransformers } from "@/context/TransformersContext";

const TransformerPage = () => {
  const { transformers, addTransformer: addFromCtx, updateTransformer, deleteTransformer: deleteFromCtx } = useTransformers();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewingTransformer, setViewingTransformer] = useState<Transformer | null>(null);

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


  const updateViewingTransformer = (updatedTransformer: Transformer) => {
    // Find the index of the transformer being viewed
    const index = transformers.findIndex(t => t.transformerNumber === updatedTransformer.transformerNumber);
    if (index !== -1) {
      // Update the transformer in the context
      updateTransformer(index, updatedTransformer);
      // Update the local viewing state
      setViewingTransformer(updatedTransformer);
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
          onUpdateTransformer={updateViewingTransformer}
        />
      )}
    {!viewingTransformer ? (
        <TransformerList
          transformers={transformers}
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
    </div>
  );
};

export default TransformerPage;
