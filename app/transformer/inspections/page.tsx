"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddTransformerModal from "@/components/AddTransformerModal";
import EditTransformerModal from "@/components/EditTransformerModal";
import { Inspection } from "@/types/inspection";
import InspectionsList from "@/components/InspectionsList";
import AddInspectionModal from "@/components/AddInspectionModal";

const InspectionsPage = () => {
    const [inspections, setInspections] = useState<Inspection[]>([]);
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

    const addInspection = (inspection: Inspection) => {
        setInspections([...inspections, inspection]);
    };

    const openEdit = (index: number) => {
        setEditingIndex(index);
        setIsEditOpen(true);
    };

    const closeEdit = () => {
        setIsEditOpen(false);
        setEditingIndex(null);
    };

    const saveEdit = (updated: Inspection) => {
        if (editingIndex === null) return;
        setInspections((prev) => prev.map((t, i) => (i === editingIndex ? updated : t)));
    };

    const deleteInspection = (index: number) => {
        setInspections((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="p-4 pb-24">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">Inspections</h1>
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
                    <div className="flex bg-gray-200 rounded-lg p-1">
                        <button
                            onClick={() => router.push("/transformer")}
                            className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-300 font-medium"
                        >
                            Transformers
                        </button>
                        <button
                            className="px-4 py-2 rounded-md bg-black text-white font-medium"
                        >
                            Inspections
                        </button>
                    </div>
                </div>
            </div>
            <AddInspectionModal addInspection={addInspection} />
            <InspectionsList inspections={inspections} onEdit={openEdit} onDelete={deleteInspection} />
            {/* <EditTransformerModal
                isOpen={isEditOpen}
                initial={editingIndex !== null ? inspections[editingIndex] : null}
                onClose={closeEdit}
                onSave={saveEdit}
            /> */}
        </div>
    );
};

export default InspectionsPage;
