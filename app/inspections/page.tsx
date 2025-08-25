"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InspectionsList from "@/components/InspectionsList";
import InspectionDetailsPanel from "@/components/InspectionDetailsPanel";
import AddInspectionModal from "@/components/AddInspectionModal";
import EditInspectionModal from "@/components/EditInspectionModal";
import { Inspection } from "@/types/inspection";
import { useInspections } from "@/context/InspectionsContext";

const InspectionsPage = () => {
    const { inspections, addInspection: addInspectionCtx, updateInspection, deleteInspection } = useInspections();
    const [viewingInspection, setViewingInspection] = useState<Inspection | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    // Filters
    const [inspQuery, setInspQuery] = useState("");
    const [tfQuery, setTfQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [favOnly, setFavOnly] = useState(false);

    const router = useRouter();

    useEffect(() => {
        try {
            const loggedIn = typeof window !== 'undefined' && localStorage.getItem("isLoggedIn") === "true";
            if (!loggedIn) {
                router.replace("/");
            }
            if (typeof window !== 'undefined') {
                setUsername(localStorage.getItem("username"));
            }
        } catch {
            router.replace("/");
        }
    }, [router]);

    const addInspection = (inspection: Inspection) => {
        addInspectionCtx(inspection);
    };

    const openView = (index: number) => {
        setViewingInspection(inspections[index]);
    };

    const closeView = () => {
        setViewingInspection(null);
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
        updateInspection(editingIndex, updated);
    };

    const deleteInspectionHandler = (index: number) => {
        deleteInspection(index);
    };

    const statusOptions = Array.from(new Set(inspections.map(i => i.status))).filter(Boolean);
    const filteredInspections = inspections.filter(i => {
        const byInsp = inspQuery.trim() === "" || i.inspectionNumber.toLowerCase().includes(inspQuery.toLowerCase());
        const byTf = tfQuery.trim() === "" || i.transformerNumber.toLowerCase().includes(tfQuery.toLowerCase());
        const byStatus = statusFilter === "" || i.status === statusFilter;
        const byFav = !favOnly || !!i.favourite;
        return byInsp && byTf && byStatus && byFav;
    });

    return (
        <div className="p-4 pb-24">
            <div className="flex items-center justify-between mb-4">
                {viewingInspection ? (
                    <h1 className="text-2xl font-bold">Inspection {viewingInspection.inspectionNumber}</h1>
                ) : (
                    <h1 className="text-2xl font-bold">All Inspections</h1>
                )}
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">Logged in as: <span className="font-medium">{username || "unknown"}</span></span>
                        <button
                            onClick={() => {
                                try {
                                    localStorage.removeItem("isLoggedIn");
                                    localStorage.removeItem("username");
                                } catch { }
                                router.replace("/");
                            }}
                            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
                        >
                            Log out
                        </button>
                    </div>
                    {!viewingInspection && (
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
                    )}
                </div>
            </div>

            {!viewingInspection && <AddInspectionModal addInspection={addInspection} />}

            {/* Filters */}
            {!viewingInspection && (
                <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input
                        value={inspQuery}
                        onChange={(e) => setInspQuery(e.target.value)}
                        placeholder="Search inspection no."
                        className="px-3 py-2 border rounded-md"
                    />
                    <input
                        value={tfQuery}
                        onChange={(e) => setTfQuery(e.target.value)}
                        placeholder="Search transformer no."
                        className="px-3 py-2 border rounded-md"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border rounded-md"
                    >
                        <option value="">All status</option>
                        {statusOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm text-black px-3 py-2">
                        <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
                        Favourites
                    </label>
                    <button
                        onClick={() => { setInspQuery(""); setTfQuery(""); setStatusFilter(""); setFavOnly(false); }}
                        className="px-3 py-2 border rounded-md bg-gray-100 hover:bg-gray-200"
                    >
                        Clear
                    </button>
                </div>
            )}

            {viewingInspection && (
                <InspectionDetailsPanel
                    inspection={viewingInspection}
                    onClose={closeView}
                />
            )}

        {!viewingInspection && (
                <InspectionsList
            inspections={filteredInspections}
                    onEdit={openEdit}
                    onDelete={deleteInspectionHandler}
                    onView={openView}
                />
            )}

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
