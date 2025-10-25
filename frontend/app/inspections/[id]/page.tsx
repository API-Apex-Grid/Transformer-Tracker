"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import InspectionDetailsPanel from "@/components/InspectionDetailsPanel";
import LoadingScreen from "@/components/LoadingScreen";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { useInspections } from "@/context/InspectionsContext";
import { Inspection } from "@/types/inspection";

const InspectionDetailPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { inspections, fetchInspectionById } = useInspections();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const inspectionRef = useRef<Inspection | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [profileSrc, setProfileSrc] = useState<string>("/avatar.png");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading inspection...");
  const [panelOverlay, setPanelOverlay] = useState<{ show: boolean; message?: string }>({ show: false });
  const [notFound, setNotFound] = useState(false);

  const handlePanelLoadingChange = useCallback((state: { show: boolean; message?: string }) => {
    setPanelOverlay((prev) => {
      if (prev.show === state.show && prev.message === state.message) return prev;
      return { show: state.show, message: state.message };
    });
  }, []);

  useEffect(() => {
    inspectionRef.current = inspection;
  }, [inspection]);

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
          setInspection(null);
          setNotFound(true);
          setIsLoading(false);
        }
        return;
      }
      const currentInspection = inspectionRef.current;
      setNotFound(false);
      const existing = inspections.find((candidate) => {
        if (candidate.id && candidate.id === rawId) return true;
        return candidate.inspectionNumber === rawId;
      });
      const targetId = existing?.id ?? rawId;
      const targetKey = existing?.id ?? existing?.inspectionNumber ?? rawId;
      const currentIdentifiers = new Set<string>();
      if (typeof currentInspection?.id === "string") {
        currentIdentifiers.add(currentInspection.id);
      }
      if (typeof currentInspection?.inspectionNumber === "string") {
        currentIdentifiers.add(currentInspection.inspectionNumber);
      }
      const candidateKeys = new Set<string>();
      if (typeof rawId === "string") candidateKeys.add(rawId);
      if (typeof targetId === "string") candidateKeys.add(targetId);
      if (typeof targetKey === "string") candidateKeys.add(targetKey);
      const matchesCurrent =
        currentIdentifiers.size > 0 &&
        Array.from(candidateKeys).some((key) => currentIdentifiers.has(key));
      if (!matchesCurrent) {
        setIsLoading(true);
        setLoadingMessage("Loading inspection...");
      }
      let resolved: Inspection | null = existing ?? currentInspection ?? null;
      try {
        const fetched = await fetchInspectionById(targetId);
        if (fetched) {
          resolved = fetched;
        }
      } catch {
        // ignore fetch failures
      }
      if (!active) return;
      if (!resolved) {
        if (!currentInspection) {
          setInspection(null);
          setNotFound(true);
        }
      } else {
        setInspection(resolved);
        setNotFound(false);
      }
      setIsLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [rawId, inspections, fetchInspectionById]);


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
        <p className="text-lg font-semibold text-gray-700">Inspection not found.</p>
        <button
          onClick={() => router.push("/inspections")}
          className="custombutton inline-flex items-center px-4 py-2 rounded"
        >
          Back to inspections
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
                onClick={() => router.back()}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <button
                onClick={() => router.push("/inspections")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                View all inspections
              </button>
            </div>
            {inspection && (
              <h1 className="text-2xl font-bold">
                Inspection {inspection.inspectionNumber}
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

        {inspection && (
          <InspectionDetailsPanel
            inspection={inspection}
            onClose={() => router.back()}
            onLoadingChange={handlePanelLoadingChange}
          />
        )}
      </div>
      <LoadingScreen
        show={isLoading || panelOverlay.show}
        message={
          panelOverlay.show
            ? panelOverlay.message || "Working..."
            : loadingMessage || "Loading inspection..."
        }
      />
    </>
  );
};

export default InspectionDetailPage;
