"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import InspectionsList from "@/components/InspectionsList";
import AddInspectionModal from "@/components/AddInspectionModal";
import EditInspectionModal from "@/components/EditInspectionModal";
import { Inspection } from "@/types/inspection";
import ThemeToggle from "@/components/ThemeToggle";
import { useInspections } from "@/context/InspectionsContext";
import LoadingScreen from "@/components/LoadingScreen";
import Logo from "@/components/Logo";

const InspectionsPage = () => {
  const {
    inspections,
    addInspection: addInspectionCtx,
    updateInspection,
    deleteInspection,
    loading,
  } = useInspections();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  // Ensure client/server render the same initial avatar; update after mount from localStorage
  const [profileSrc, setProfileSrc] = useState<string>("/avatar.png");

  // Filters
  const [inspQuery, setInspQuery] = useState("");
  const [tfQuery, setTfQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  const addInspection = (inspection: Inspection) => {
    addInspectionCtx(inspection);
  };

  const resolveContextIndex = (item: Inspection | undefined): number => {
    if (!item) return -1;
    if (item.id) {
      const byId = inspections.findIndex((candidate) => candidate.id === item.id);
      if (byId >= 0) return byId;
    }
    return inspections.findIndex(
      (candidate) => candidate.inspectionNumber === item.inspectionNumber
    );
  };

  const openView = (index: number) => {
    const item = filteredInspections[index];
    if (!item) return;
    const identifier = item.id ?? encodeURIComponent(item.inspectionNumber);
    router.push(`/inspections/${identifier}`);
  };

  const openEdit = (index: number) => {
    const item = filteredInspections[index];
    const contextIndex = resolveContextIndex(item);
    if (!item || contextIndex === -1) return;
    setEditingIndex(contextIndex);
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
    const item = filteredInspections[index];
    const contextIndex = resolveContextIndex(item);
    if (!item || contextIndex === -1) return;
    deleteInspection(contextIndex);
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter((inspection) => {
      const byInspection =
        inspQuery.trim() === "" ||
        inspection.inspectionNumber
          .toLowerCase()
          .includes(inspQuery.toLowerCase());
      const byTransformer =
        tfQuery.trim() === "" ||
        inspection.transformerNumber
          .toLowerCase()
          .includes(tfQuery.toLowerCase());
      const byStatus =
        statusFilter === "" || inspection.status === statusFilter;
      const byFav = !favOnly || !!inspection.favourite;
      return byInspection && byTransformer && byStatus && byFav;
    });
  }, [inspections, inspQuery, tfQuery, statusFilter, favOnly]);

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(inspections.map((inspection) => inspection.status))).filter(
        Boolean
      ),
    [inspections]
  );

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
            <h1 className="text-2xl font-bold">All Inspections</h1>
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
                  // Avoid Next.js optimization pipeline for data URLs to keep attributes consistent
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
                className="inline-flex items-center rounded-md px-4 py-2 custombutton"
              >
                Log out
              </button>
            </div>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => router.push("/transformer")}
                className="px-4 py-2 rounded-md custombutton font-medium mr-1"
              >
                Transformers
              </button>
              <button
                disabled={true}
                className="px-4 py-2 rounded-md disabledbutton font-medium ml-1"
              >
                Inspections
              </button>
            </div>
          </div>
        </div>

        <AddInspectionModal addInspection={addInspection} />

        {/* Filters */}
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
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
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
              setInspQuery("");
              setTfQuery("");
              setStatusFilter("");
              setFavOnly(false);
            }}
            className="px-3 py-2 border rounded-md bg-gray-100 hover:bg-gray-200"
          >
            Clear
          </button>
        </div>

        <InspectionsList
          inspections={filteredInspections}
          onEdit={openEdit}
          onDelete={deleteInspectionHandler}
          onView={openView}
        />

        <EditInspectionModal
          isOpen={isEditOpen}
          initial={editingIndex !== null ? inspections[editingIndex] : null}
          onClose={closeEdit}
          onSave={saveEdit}
        />
      </div>
  <LoadingScreen show={loading} message="Loading inspections..." />
    </>
  );
};

export default InspectionsPage;
