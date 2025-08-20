"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddTransformerModal from "@/components/AddTransformerModal";
import TransformerList from "@/components/TransformerList";
import EditTransformerModal from "@/components/EditTransformerModal";
import { Transformer } from "@/types/transformer";

const TransformerPage = () => {
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    setTransformers([...transformers, transformer]);
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
    setTransformers((prev) => prev.map((t, i) => (i === editingIndex ? updated : t)));
  };

  const deleteTransformer = (index: number) => {
    setTransformers((prev) => prev.filter((_, i) => i !== index));
  };

  return (
  <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transformers</h1>
        <button
          onClick={() => {
            try {
              localStorage.removeItem("isLoggedIn");
            } catch {}
            router.replace("/");
          }}
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
        >
          Log out
        </button>
      </div>
      <AddTransformerModal addTransformer={addTransformer} />
      <TransformerList transformers={transformers} onEdit={openEdit} onDelete={deleteTransformer} />
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
