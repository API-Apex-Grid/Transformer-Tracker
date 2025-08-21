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
  // search & filters
  const [searchTransformer, setSearchTransformer] = useState("");
  const [searchPole, setSearchPole] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterType, setFilterType] = useState("");

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

  const filteredTransformers = transformers.filter((t) => {
    const matchesTransformer = searchTransformer
      ? t.transformerNumber.toLowerCase().includes(searchTransformer.toLowerCase())
      : true;
    const matchesPole = searchPole
      ? t.poleNumber.toLowerCase().includes(searchPole.toLowerCase())
      : true;
    const matchesRegion = filterRegion ? t.region === filterRegion : true;
    const matchesType = filterType ? t.type === filterType : true;
    return matchesTransformer && matchesPole && matchesRegion && matchesType;
  });

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transformers</h1>
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
        </div>
      </div>
      {/* search & filters */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search transformer number"
          value={searchTransformer}
          onChange={(e) => setSearchTransformer(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
        />
        <input
          type="text"
          placeholder="Search pole number"
          value={searchPole}
          onChange={(e) => setSearchPole(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
        />
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 pr-8 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
        >
          <option value="">All regions</option>
          <option>Anuradhapura</option>
          <option>Colombo</option>
          <option>Trincomalee</option>
          <option>Jaffna</option>
          <option>Kandy</option>
          <option>Galle</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 pr-8 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
        >
          <option value="">All types</option>
          <option>Distribution</option>
          <option>Bulk</option>
        </select>
      </div>

      <AddTransformerModal addTransformer={addTransformer} />
      <TransformerList transformers={filteredTransformers} onEdit={openEdit} onDelete={deleteTransformer} />
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
