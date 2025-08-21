"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inspection } from "@/types/inspection";
import InspectionsList from "@/components/InspectionsList";
import AddInspectionModal from "@/components/AddInspectionModal";
import EditInspectionModal from "@/components/EditInspectionModal";
import { useInspections } from "@/context/InspectionsContext";

const InspectionsPage = () => {
    const { inspections, addInspection, updateInspection, deleteInspection } = useInspections();
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
        updateInspection(editingIndex, updated);
    };

    return (
        <div className="p-4 pb-24">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">All Inspections</h1>
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
            <EditInspectionModal
                isOpen={isEditOpen}
                initial={editingIndex !== null ? inspections[editingIndex] : null}
                onClose={closeEdit}
                onSave={saveEdit}
            />
        </div>
    );
};

export default InspectionsPage;
