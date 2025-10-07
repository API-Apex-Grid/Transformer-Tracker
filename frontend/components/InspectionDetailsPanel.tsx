"use client";

import { Inspection } from "@/types/inspection";
import { Transformer } from "@/types/transformer";
import ThermalImage from "@/components/ThermalImage";
import OverlayedThermal, { OverlayToggles, OverlayBoxInfo } from "@/components/OverlayedThermal";
import { useTransformers } from "@/context/TransformersContext";
import { useInspections } from "@/context/InspectionsContext";
import { useState, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { useEffect } from "react";

const toFinite = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
};

const canonicalizeFault = (fault: string | null | undefined): string => {
    if (!fault) return "none";
    const normalized = fault.toString().trim().toLowerCase().replace(/[\-_]+/g, " ");
    if (!normalized) return "none";
    if (normalized.includes("loose") && normalized.includes("joint")) return "loose joint";
    if (normalized.includes("wire") && normalized.includes("overload")) return "wire overload";
    if (normalized.includes("point") && normalized.includes("overload")) return "point overload";
    if (normalized === "none" || normalized === "ok" || normalized === "normal") return "none";
    return normalized;
};

const toDisplayLabel = (fault: string): string => {
    if (!fault || fault === "none") return "No classification";
    return fault
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

const faultToToggleKey = (fault: string | null | undefined): keyof OverlayToggles | null => {
    const normalized = canonicalizeFault(fault);
    switch (normalized) {
        case "loose joint":
            return "looseJoint";
        case "point overload":
            return "pointOverload";
        case "wire overload":
            return "wireOverload";
        default:
            return null;
    }
};

const parseBoundingBoxes = (raw: Inspection["boundingBoxes"]): number[][] => {
    let source: unknown = raw;
    if (typeof source === "string") {
        try { source = JSON.parse(source); }
        catch { return []; }
    }
    if (!Array.isArray(source)) return [];
    if (source.length === 0) return [];

    const boxes: number[][] = [];
    const maybePush = (x: number | null, y: number | null, w: number | null, h: number | null) => {
        if (x === null || y === null || w === null || h === null) return;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        boxes.push([x, y, w, h]);
    };

    const arraySource = source as unknown[];
    if (typeof arraySource[0] === "number" || typeof arraySource[0] === "string") {
        const flat = arraySource as Array<number | string>;
        for (let i = 0; i + 3 < flat.length; i += 4) {
            maybePush(
                toFinite(flat[i]),
                toFinite(flat[i + 1]),
                toFinite(flat[i + 2]),
                toFinite(flat[i + 3])
            );
        }
        return boxes;
    }

    for (const entry of arraySource) {
        if (Array.isArray(entry)) {
            maybePush(
                toFinite(entry[0]),
                toFinite(entry[1]),
                toFinite(entry[2]),
                toFinite(entry[3])
            );
            continue;
        }
        if (entry && typeof entry === "object") {
            const obj = entry as Record<string, unknown>;
            const x = toFinite(obj.x ?? obj.left ?? obj.startX ?? obj[0]);
            const y = toFinite(obj.y ?? obj.top ?? obj.startY ?? obj[1]);
            let w = toFinite(obj.w ?? obj.width ?? obj[2]);
            let h = toFinite(obj.h ?? obj.height ?? obj[3]);
            if ((w === null || h === null) && x !== null && y !== null) {
                const x2 = toFinite(obj.x2 ?? obj.right ?? obj.endX);
                const y2 = toFinite(obj.y2 ?? obj.bottom ?? obj.endY);
                if (w === null && x2 !== null) w = x2 - x;
                if (h === null && y2 !== null) h = y2 - y;
            }
            maybePush(x, y, w, h);
        }
    }

    return boxes;
};

const parseFaultTypes = (raw: Inspection["faultTypes"], expectedLength: number): string[] => {
    let source: unknown = raw;
    if (typeof source === "string") {
        const original = source;
        try {
            const parsed = JSON.parse(original);
            source = parsed;
        } catch {
            source = original
                .split(/[,;\n]+/)
                .map((part: string) => part.trim())
                .filter((part) => part.length > 0);
        }
    }
    const arr: string[] = Array.isArray(source)
        ? (source as unknown[]).map((item) => (typeof item === "string" ? item : item != null ? String(item) : ""))
        : (typeof source === "string" ? [source] : []);

    const normalized = arr.map((fault) => canonicalizeFault(fault));
    if (normalized.length < expectedLength) {
        normalized.push(...Array.from({ length: expectedLength - normalized.length }, () => "none"));
    }
    return normalized.slice(0, expectedLength);
};

const buildBoxInfo = (boxes: number[][], faults: string[]): OverlayBoxInfo[] => (
    boxes.map((box, index) => {
        const fault = faults[index] ?? "none";
        return {
            x: box[0],
            y: box[1],
            w: box[2],
            h: box[3],
            boxFault: fault,
            label: toDisplayLabel(fault),
        };
    })
);

interface InspectionDetailsPanelProps {
    inspection: Inspection;
    onClose: () => void;
}

const InspectionDetailsPanel = ({ inspection, onClose }: InspectionDetailsPanelProps) => {
    const { transformers, reload: reloadTransformers } = useTransformers();
    const { reload } = useInspections();
    const [selectedWeather, setSelectedWeather] = useState<string>(
        // Prefer last analysis weather when present, else current inspection weather, else sunny
        (inspection.lastAnalysisWeather as string) || inspection.weather || "sunny"
    );
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(inspection.imageUrl || null);
    const [uploadedAt, setUploadedAt] = useState<string | null>(inspection.imageUploadedAt || null);
    const [uploadedBy, setUploadedBy] = useState<string | null>(inspection.imageUploadedBy || null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [aiStats, setAiStats] = useState<{
        prob?: number;
        histDistance?: number;
        dv95?: number;
        warmFraction?: number;
        boxes?: number[][] | number[];
        boxInfo?: (OverlayBoxInfo & { severity?: number; severityLabel?: string; avgDeltaV?: number; maxDeltaV?: number; })[];
    // dimensions omitted; overlay infers them from the image element
        imageWidth?: number;
        imageHeight?: number;
        overallSeverity?: number;
        overallSeverityLabel?: string;
    } | null>(null);
    const [overlayToggles, setOverlayToggles] = useState<OverlayToggles>({ looseJoint: true, pointOverload: true, wireOverload: true });
    // Local states for stored analysis so we can update immediately after delete
    const [storedBoxes, setStoredBoxes] = useState<number[][]>([]);
    const [storedFaultTypes, setStoredFaultTypes] = useState<string[]>([]);
    const [storedBoxInfo, setStoredBoxInfo] = useState<OverlayBoxInfo[]>([]);
    // Drawing & modal state
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [drawTarget, setDrawTarget] = useState<"ai" | "stored" | null>(null);
    const [pendingRect, setPendingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [showFaultModal, setShowFaultModal] = useState(false);
    const [faultSelection, setFaultSelection] = useState<string>("loose joint");

    const storedFaultSummary = useMemo(() => {
        if (!storedBoxInfo.length) return [] as Array<{ fault: string; label: string; count: number }>;
        const counts = storedBoxInfo.reduce<Record<string, number>>((acc, box) => {
            const key = canonicalizeFault(box.boxFault ?? "none");
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts)
            .map(([fault, count]) => ({ fault, label: toDisplayLabel(fault), count }))
            .sort((a, b) => b.count - a.count);
    }, [storedBoxInfo]);

    const storedVisibleBoxCount = useMemo(() => {
        if (!storedBoxInfo.length) return 0;
        const anyToggleEnabled = overlayToggles.looseJoint || overlayToggles.pointOverload || overlayToggles.wireOverload;
        return storedBoxInfo.reduce((count, box) => {
            const toggleKey = faultToToggleKey(box.boxFault);
            if (toggleKey) {
                return overlayToggles[toggleKey] ? count + 1 : count;
            }
            return anyToggleEnabled ? count + 1 : count;
        }, 0);
    }, [overlayToggles, storedBoxInfo]);

    const transformer = useMemo(() => (
        transformers.find(t => t.transformerNumber === inspection.transformerNumber)
    ), [transformers, inspection.transformerNumber]);
    const nestedTransformer: Transformer | undefined = useMemo(() => {
        const anyObj = inspection as unknown as { transformer?: Transformer };
        return anyObj.transformer;
    }, [inspection]);

    const effectiveUploadedUrl = useMemo(() => {
        return uploadedUrl ?? (inspection.imageUrl || null);
    }, [uploadedUrl, inspection.imageUrl]);

    const storedImageUrl = useMemo(() => {
        return (inspection.imageUrl || uploadedUrl || previewUrl) || null;
    }, [inspection.imageUrl, uploadedUrl, previewUrl]);

    const baselineForWeather = (weather?: string | null) => {
        const source = (transformer && (transformer.sunnyImage || transformer.cloudyImage || transformer.windyImage)) ? transformer : (nestedTransformer as Transformer | undefined);
        if (!source) return null;
        switch (weather) {
            case "sunny":
                return source.sunnyImage || null;
            case "cloudy":
                return source.cloudyImage || null;
            case "rainy":
                // Map rainy to windy baseline if rainy is not modeled; adjust if needed
                return source.windyImage || null;
            default:
                return source.sunnyImage || source.cloudyImage || source.windyImage || null;
        }
    };

    // When switching to a different inspection, reinitialize weather and image state
    useEffect(() => {
        setSelectedWeather((inspection.lastAnalysisWeather as string) || inspection.weather || "sunny");
        setUploadedUrl(inspection.imageUrl || null);
        setUploadedAt(inspection.imageUploadedAt || null);
        setUploadedBy(inspection.imageUploadedBy || null);
        setAiStats(null);
        setPreviewUrl(null);
        // initialize stored analysis states from inspection
        try {
            const parsedBoxes = parseBoundingBoxes(inspection.boundingBoxes);
            const parsedFaults = parseFaultTypes(inspection.faultTypes, parsedBoxes.length);
            setStoredBoxes(parsedBoxes);
            setStoredFaultTypes(parsedFaults);
            setStoredBoxInfo(buildBoxInfo(parsedBoxes, parsedFaults));
        } catch {
            setStoredBoxes([]);
            setStoredFaultTypes([]);
            setStoredBoxInfo([]);
        }
    // Also update when boundingBoxes/faultTypes/imageUrl change on the same inspection id
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inspection.id, inspection.boundingBoxes, inspection.faultTypes, inspection.imageUrl]);

    useEffect(() => {
        if (aiStats || storedBoxInfo.length === 0) return;
        setOverlayToggles((prev) => {
            const next = { ...prev } as OverlayToggles;
            let changed = false;
            for (const box of storedBoxInfo) {
                const key = faultToToggleKey(box.boxFault);
                if (key && !next[key]) {
                    next[key] = true;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [aiStats, storedBoxInfo]);

    const handleUpload = async (file: File, weather: string) => {
        if (!inspection.id) return;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("weather", weather);
    const res = await fetch(apiUrl(`/api/inspections/${inspection.id}/upload`), {
            method: "POST",
            body: formData,
            headers: {
                'x-username': (typeof window !== 'undefined' ? (localStorage.getItem('username') || '') : '')
            }
        });
        if (res.ok) {
            const updated = await res.json();
            setUploadedUrl(updated.imageUrl ?? null);
            setSelectedWeather(updated.weather || selectedWeather);
            setUploadedAt(updated.imageUploadedAt || null);
            setUploadedBy(updated.imageUploadedBy || uploadedBy);
            // Clear any previous analysis overlays for new image
            setAiStats(null);
        }
        await reload();
    };

    const uploadBaseline = async (file: File, weather: string) => {
        if (!transformer?.id) return;
        const form = new FormData();
        form.append("file", file);
        form.append("weather", weather);
    await fetch(apiUrl(`/api/transformers/${transformer.id}/baseline`), {
            method: "POST",
            body: form,
            headers: {
                'x-username': (typeof window !== 'undefined' ? (localStorage.getItem('username') || '') : '')
            }
        });
        await reloadTransformers();
    };

    return (
        <div className="details-panel border rounded-lg shadow-lg mb-6 p-6 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Inspection Details</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-bold">Inspection Number</label>
                    <p className="mt-1 text-sm">{inspection.inspectionNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold">Transformer Number</label>
                    <p className="mt-1 text-sm">{inspection.transformerNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold">Branch</label>
                    <p className="mt-1 text-sm">{inspection.branch}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold">Inspected Date</label>
                    <p className="mt-1 text-sm">{inspection.inspectedDate}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold">Maintenance Date</label>
                    <p className="mt-1 text-sm">{inspection.maintainanceDate || 'N/A'}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold">Status</label>
                    <span
                        className={`inline-block px-2 py-1 text-xs font-semibold rounded ${inspection.status === 'Pending' ? 'bg-red-100 text-red-800 border border-red-300' :
                                inspection.status === 'In Progress' ? 'bg-green-100 text-green-800 border border-green-300' :
                                    inspection.status === 'Completed' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                        'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}
                    >
                        {inspection.status}
                    </span>
                </div>
                                {inspection.uploadedBy && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Uploaded by</label>
                                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{inspection.uploadedBy}</p>
                                    </div>
                                )}
            </div>

            {/* Thermal Image Upload & Comparison */}
            <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Thermal Image</h3>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700/60"
                            title="Clear stored image and analysis"
                            onClick={async () => {
                                if (!inspection.id) return;
                                try {
                                    await fetch(apiUrl(`/api/inspections/${inspection.id}/clear-analysis`), { method: 'POST' });
                                    // Reset local UI state
                                    setPreviewUrl(null);
                                    setUploadedUrl(null);
                                    setUploadedAt(null);
                                    setUploadedBy(null);
                                    setAiStats(null);
                                    // Clear local stored analysis immediately
                                    setStoredBoxes([]);
                                    setStoredFaultTypes([]);
                                    setStoredBoxInfo([]);
                                    await reload();
                                    await reloadTransformers();
                                } catch {
                                    // no-op
                                }
                            }}
                        >
                            Clear analysis
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Uploader */}
                    <ThermalImage
                        onImageUpload={(file) => handleUpload(file, selectedWeather)}
                        onWeatherChange={(w) => setSelectedWeather(w)}
                        defaultWeather={selectedWeather}
                        onAnalyze={() => { /* handled inside component */ }}
                        onResetAnalysis={() => {
                            setAiStats(null);
                        }}
                        inspectionId={inspection.id as string}
                        onPreviewUrl={(u) => setPreviewUrl(u)}
                        onAnalysisResult={(res) => {
                            setAiStats({
                                prob: res.prob,
                                histDistance: res.histDistance,
                                dv95: res.dv95,
                                warmFraction: res.warmFraction,
                                boxes: res.boxes as number[][] | number[],
                                boxInfo: res.boxInfo || [],
                                imageWidth: res.imageWidth,
                                imageHeight: res.imageHeight,
                                overallSeverity: res.overallSeverity,
                                overallSeverityLabel: res.overallSeverityLabel,
                            });
                            // Persisted on backend; optimistically update local selected weather and image
                            setSelectedWeather(selectedWeather);
                            // Ensure the uploaded image remains the default shown after analysis
                            if (previewUrl) setUploadedUrl(previewUrl);
                            // Reload list to pull updated lastAnalysisWeather and weather
                            void reload();
                        }}
                    />

                    {/* Side-by-side Comparison */}
                    <div className="details-panel bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors">
                        <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Comparison</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Baseline ({selectedWeather})</p>
                                {baselineForWeather(selectedWeather) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={baselineForWeather(selectedWeather) as string} alt="Baseline" className="w-full h-56 object-contain border border-gray-200 dark:border-gray-700 rounded" />
                                ) : (
                                        <div className="w-full h-56 flex flex-col gap-2 items-center justify-center border border-gray-200 dark:border-gray-700 rounded text-gray-400">
                                        <span>No baseline</span>
                                        <label className="px-3 py-1 text-sm bg-black dark:bg-white text-white dark:text-black rounded cursor-pointer">
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) uploadBaseline(f, selectedWeather);
                                            }} />
                                            Add baseline
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Uploaded</p>
                                                                {effectiveUploadedUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={effectiveUploadedUrl as string} alt="Uploaded" className="w-full h-56 object-contain border border-gray-200 dark:border-gray-700 rounded" />
                                ) : (
                                    <div className="w-full h-56 flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded text-gray-400">No image uploaded</div>
                                )}
                                                {(uploadedBy || uploadedAt || inspection.imageUploadedBy || inspection.imageUploadedAt) && (
                                                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    by {(uploadedBy || inspection.imageUploadedBy) || 'unknown'}
                                                    {(uploadedAt || inspection.imageUploadedAt) ? ` on ${new Date(uploadedAt || inspection.imageUploadedAt as string).toLocaleString()}` : ''}
                                                                    </p>
                                                                )}
                            </div>
                        </div>
                        {/* Overlay output with toggles */}
                        <div className="mt-4">
                                                        <div className="flex items-center gap-4 mb-2">
                                                                <button
                                                                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                    onClick={() => {
                                                                        const allOn = overlayToggles.looseJoint && overlayToggles.pointOverload && overlayToggles.wireOverload;
                                                                        setOverlayToggles({ looseJoint: !allOn, pointOverload: !allOn, wireOverload: !allOn });
                                                                    }}
                                                                >
                                                                    {overlayToggles.looseJoint && overlayToggles.pointOverload && overlayToggles.wireOverload ? 'Show none' : 'Show all'}
                                                                </button>
                                <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-300">
                                    <input type="checkbox" checked={overlayToggles.looseJoint} onChange={(e) => setOverlayToggles(t => ({...t, looseJoint: e.target.checked}))} />
                                    Loose joint
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-300">
                                    <input type="checkbox" checked={overlayToggles.pointOverload} onChange={(e) => setOverlayToggles(t => ({...t, pointOverload: e.target.checked}))} />
                                    Point overload
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-300">
                                    <input type="checkbox" checked={overlayToggles.wireOverload} onChange={(e) => setOverlayToggles(t => ({...t, wireOverload: e.target.checked}))} />
                                    Wire overload
                                </label>
                            </div>
                            {(previewUrl || effectiveUploadedUrl) && aiStats ? (
                                <div className="overscroll-none overflow-hidden">
                                    <OverlayedThermal
                                        imageUrl={(previewUrl || effectiveUploadedUrl) as string}
                                        naturalWidth={aiStats.imageWidth}
                                        naturalHeight={aiStats.imageHeight}
                                        boxes={(aiStats.boxes as number[][]) ?? []}
                                        boxInfo={(aiStats.boxInfo ?? []).map((bi, i) => ({ ...bi, label: String(i + 1) }))}
                                        toggles={overlayToggles}
                                        allowDraw={isDrawMode && drawTarget === 'ai'}
                                        onDrawComplete={(rect) => {
                                            setPendingRect(rect);
                                            setShowFaultModal(true);
                                        }}
                                        resetKey={`${inspection.id}-ai`}
                                        onRemoveBox={async (idx, box) => {
                                        if (!inspection.id) return;
                                        try {
                                            // Optimistically update local aiStats
                                            setAiStats((prev) => {
                                                if (!prev) return prev;
                                                const next = { ...prev };
                                                if (Array.isArray(next.boxes)) {
                                                    const arr = (next.boxes as number[][]).slice();
                                                    if (box) {
                                                        const matchIdx = arr.findIndex((b) => b && b.length >= 4 && b[0] === box.x && b[1] === box.y && b[2] === box.w && b[3] === box.h);
                                                        if (matchIdx >= 0) arr.splice(matchIdx, 1); else arr.splice(idx, 1);
                                                    } else {
                                                        arr.splice(idx, 1);
                                                    }
                                                    next.boxes = arr;
                                                }
                                                if (Array.isArray(next.boxInfo)) {
                                                    const info = (next.boxInfo as OverlayBoxInfo[]).slice();
                                                    if (box) {
                                                        const matchInfoIdx = info.findIndex((bi) => bi && bi.x === box.x && bi.y === box.y && bi.w === box.w && bi.h === box.h);
                                                        if (matchInfoIdx >= 0) info.splice(matchInfoIdx, 1); else info.splice(idx, 1);
                                                    } else {
                                                        info.splice(idx, 1);
                                                    }
                                                    next.boxInfo = info;
                                                }
                                                return next;
                                            });
                                            // Call backend to persist removal in DB (both boundingBoxes and faultTypes) by value for precision
                                            if (box) {
                                                const params = new URLSearchParams({ x: String(box.x), y: String(box.y), w: String(box.w), h: String(box.h) });
                                                await fetch(apiUrl(`/api/inspections/${inspection.id}/boxes?${params.toString()}`), { method: 'DELETE' });
                                            } else {
                                                await fetch(apiUrl(`/api/inspections/${inspection.id}/boxes/${idx}`), { method: 'DELETE' });
                                            }
                                            // Reload to ensure context picks up latest persisted state
                                            await reload();
                                        } catch {
                                            // ignore errors for now; a full toast can be added later
                                        }
                                    }}
                                    containerClassName="w-full border rounded overflow-hidden"
                                />
                                    {/* Add box button for AI overlay */}
                                    <div className="mt-2 flex gap-2">
                                        <button
                                            className={`px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded ${isDrawMode && drawTarget === 'ai' ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-gray-900 dark:text-white'}`}
                                            onClick={() => { setIsDrawMode(true); setDrawTarget('ai'); }}
                                        >
                                            {isDrawMode && drawTarget === 'ai' ? 'Drawing: click-drag on image' : 'Add box'}
                                        </button>
                                        {isDrawMode && drawTarget === 'ai' && (
                                            <button className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white" onClick={() => { setIsDrawMode(false); setDrawTarget(null); setPendingRect(null); }}>
                                                Cancel drawing
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-56 flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded text-gray-400">
                                    Run analysis to see overlay
                                </div>
                            )}
                            {aiStats && (aiStats.boxInfo?.length ?? 0) > 0 && (
                                <ol className="mt-2 text-xs text-gray-700 dark:text-gray-300 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                    {aiStats.boxInfo!.map((bi, i) => {
                                        const fault = toDisplayLabel(canonicalizeFault(bi.boxFault || 'none'));
                                        const sev = typeof bi.severity === 'number' ? bi.severity : undefined;
                                        const sevPct = typeof sev === 'number' ? Math.round(sev * 100) : undefined;
                                        return (
                                            <li key={`ai-legend-${i}`} className="flex items-center gap-2">
                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-900 dark:bg-gray-200 text-white dark:text-black text-[10px] font-semibold">{i + 1}</span>
                                                <span>{fault}{sevPct !== undefined ? ` · Severity ${sevPct}%` : ''}</span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                            {typeof aiStats?.prob === 'number' && (
                                <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                                    <span className="font-semibold">Confidence:</span> {aiStats.prob.toFixed(2)}
                                </div>
                            )}
                            {typeof aiStats?.overallSeverity === 'number' && (
                                <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                                    <span className="font-semibold">Overall severity:</span> {Math.round((aiStats.overallSeverity ?? 0) * 100)}% {aiStats.overallSeverityLabel ? `(${aiStats.overallSeverityLabel})` : ''}
                                </div>
                            )}
                            {/* Stored analysis display: if inspection has an imageUrl and saved boundingBoxes, show them */}
                            {(!aiStats && storedImageUrl) && (
                                <div className="mt-4">
                                    <h5 className="font-semibold mb-2 text-gray-900 dark:text-white">Stored analysis</h5>
                                    {storedBoxInfo.length > 0 ? (
                                        <div className="overscroll-none overflow-hidden">
                                            {(storedFaultSummary.length > 0 || storedVisibleBoxCount === 0) && (
                                                <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-600 dark:text-gray-400">
                                                    {storedFaultSummary.map((item) => (
                                                        <span key={item.fault} className="details-panel inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800">
                                                            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.count}</span>
                                                            <span>{item.label}</span>
                                                        </span>
                                                    ))}
                                                    {storedVisibleBoxCount === 0 && storedBoxInfo.length > 0 && (
                                                        <button
                                                            type="button"
                                                            className="details-panel ml-auto inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                            onClick={() => setOverlayToggles({ looseJoint: true, pointOverload: true, wireOverload: true })}
                                                        >
                                                            Show all overlays
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <OverlayedThermal
                                                imageUrl={storedImageUrl as string}
                                                // No persisted dims; component infers automatically from the image element
                                                // Boxes are stored as natural image pixel coordinates (same space as analyze output)
                                                boxes={storedBoxes}
                                                boxInfo={storedBoxInfo.map((bi, idx) => ({ ...bi, label: String(idx + 1) }))}
                                                toggles={overlayToggles}
                                                allowDraw={isDrawMode && drawTarget === 'stored'}
                                                onDrawComplete={(rect) => { setPendingRect(rect); setShowFaultModal(true); }}
                                                resetKey={`${inspection.id}-stored`}
                                                onRemoveBox={async (idx, box) => {
                                                    if (!inspection.id) return;
                                                    try {
                                                        let matchIdx = idx;
                                                        if (box && Array.isArray(storedBoxes)) {
                                                            const found = storedBoxes.findIndex((b) => b && b.length >= 4 && b[0] === box.x && b[1] === box.y && b[2] === box.w && b[3] === box.h);
                                                            if (found >= 0) matchIdx = found;
                                                        }
                                                        const newBoxes = Array.isArray(storedBoxes) ? storedBoxes.slice() : [];
                                                        if (matchIdx >= 0 && matchIdx < newBoxes.length) newBoxes.splice(matchIdx, 1);
                                                        const newFaults = Array.isArray(storedFaultTypes) ? storedFaultTypes.slice() : [];
                                                        if (matchIdx >= 0 && matchIdx < newFaults.length) newFaults.splice(matchIdx, 1);
                                                        setStoredBoxes(newBoxes);
                                                        setStoredFaultTypes(newFaults);
                                                        setStoredBoxInfo(buildBoxInfo(newBoxes, newFaults));
                                                        if (box) {
                                                            const params = new URLSearchParams({ x: String(box.x), y: String(box.y), w: String(box.w), h: String(box.h) });
                                                            await fetch(apiUrl(`/api/inspections/${inspection.id}/boxes?${params.toString()}`), { method: 'DELETE' });
                                                        } else {
                                                            await fetch(apiUrl(`/api/inspections/${inspection.id}/boxes/${idx}`), { method: 'DELETE' });
                                                        }
                                                        void reload();
                                                    } catch {
                                                        // no-op
                                                    }
                                                }}
                                                containerClassName="w-full border rounded overflow-hidden"
                                            />
                                            {/* Add box button for stored overlay */}
                                            <div className="mt-2 flex gap-2">
                                                <button
                                                    className={`px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded ${isDrawMode && drawTarget === 'stored' ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-gray-900 dark:text-white'}`}
                                                    onClick={() => { setIsDrawMode(true); setDrawTarget('stored'); }}
                                                >
                                                    {isDrawMode && drawTarget === 'stored' ? 'Drawing: click-drag on image' : 'Add box'}
                                                </button>
                                                {isDrawMode && drawTarget === 'stored' && (
                                                    <button className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white" onClick={() => { setIsDrawMode(false); setDrawTarget(null); setPendingRect(null); }}>
                                                        Cancel drawing
                                                    </button>
                                                )}
                                            </div>
                                            {storedBoxInfo.length > 0 && (
                                                <ol className="mt-2 text-xs text-gray-700 dark:text-gray-300 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                                    {storedBoxInfo.map((bi, i) => (
                                                        <li key={`stored-legend-${i}`} className="flex items-center gap-2">
                                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-900 dark:bg-gray-200 text-white dark:text-black text-[10px] font-semibold">{i + 1}</span>
                                                            <span>{toDisplayLabel(canonicalizeFault(bi.boxFault || 'none'))}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">No stored bounding boxes found for this inspection.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Fault selection modal */}
                {showFaultModal && pendingRect && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="details-panel bg-white dark:bg-[#111] rounded shadow-lg p-4 w-80">
                            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Select fault type</h3>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Fault type</label>
                            <select
                                className="details-panel w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mb-4 bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-white"
                                value={faultSelection}
                                onChange={(e) => setFaultSelection(e.target.value)}
                            >
                                <option value="loose joint">Loose joint</option>
                                <option value="point overload">Point overload</option>
                                <option value="wire overload">Wire overload</option>
                                <option value="none">None</option>
                            </select>
                            <div className="flex justify-end gap-2">
                                <button
                                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                    onClick={() => { setShowFaultModal(false); setPendingRect(null); setIsDrawMode(false); setDrawTarget(null); }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-3 py-1 text-sm rounded bg-black dark:bg-white text-white dark:text-black"
                                    onClick={async () => {
                                        if (!inspection.id || !pendingRect) return;
                                        const ft = faultSelection;
                                        const rect = pendingRect; // capture before clearing state
                                        // Optimistically update UI so the new box appears immediately
                                        setStoredBoxes((prev) => [...prev, [rect.x, rect.y, rect.w, rect.h]]);
                                        setStoredFaultTypes((prev) => [...prev, ft]);
                                        setStoredBoxInfo((prev) => [...prev, { x: rect.x, y: rect.y, w: rect.w, h: rect.h, boxFault: ft }]);
                                        const key = faultToToggleKey(ft);
                                        if (key) setOverlayToggles((t) => ({ ...t, [key]: true } as OverlayToggles));
                                        setAiStats((prev) => {
                                            if (!prev) return prev;
                                            const next = { ...prev };
                                            const bxs = Array.isArray(next.boxes) ? (next.boxes as number[][]).slice() : [];
                                            bxs.push([rect.x, rect.y, rect.w, rect.h]);
                                            next.boxes = bxs;
                                            const info = Array.isArray(next.boxInfo) ? (next.boxInfo as OverlayBoxInfo[]).slice() : [];
                                            info.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, boxFault: ft });
                                            next.boxInfo = info;
                                            return next;
                                        });
                                        // Close modal immediately after clicking save
                                        setShowFaultModal(false);
                                        setPendingRect(null);
                                        setIsDrawMode(false);
                                        setDrawTarget(null);
                                        // Persist in background
                                        try {
                                            const res = await fetch(`/api/inspections/${inspection.id}/boxes`, {
                                                method: 'POST',
                                                headers: { 'content-type': 'application/json' },
                                                body: JSON.stringify({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, faultType: ft }),
                                            });
                                            if (!res.ok) {
                                                alert('Failed to save box. The overlay was added locally, but did not persist.');
                                                await reload();
                                            }
                                        } catch {
                                            alert('Network error saving box. The overlay was added locally, but did not persist.');
                                        }
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InspectionDetailsPanel;
