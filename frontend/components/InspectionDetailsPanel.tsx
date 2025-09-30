"use client";

import { Inspection } from "@/types/inspection";
import ThermalImage from "@/components/ThermalImage";
import OverlayedThermal, { OverlayToggles, OverlayBoxInfo } from "@/components/OverlayedThermal";
import { useTransformers } from "@/context/TransformersContext";
import { useInspections } from "@/context/InspectionsContext";
import { useState, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { useEffect } from "react";

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
        boxInfo?: OverlayBoxInfo[];
    // dimensions omitted; overlay infers them from the image element
        imageWidth?: number;
        imageHeight?: number;
    } | null>(null);
    const [overlayToggles, setOverlayToggles] = useState<OverlayToggles>({ looseJoint: true, pointOverload: true, wireOverload: true });
    // Local states for stored analysis so we can update immediately after delete
    const [storedBoxes, setStoredBoxes] = useState<number[][]>([]);
    const [storedFaultTypes, setStoredFaultTypes] = useState<string[]>([]);
    const [storedBoxInfo, setStoredBoxInfo] = useState<OverlayBoxInfo[]>([]);

    const transformer = useMemo(() => (
        transformers.find(t => t.transformerNumber === inspection.transformerNumber)
    ), [transformers, inspection.transformerNumber]);

    const effectiveUploadedUrl = useMemo(() => {
        return uploadedUrl ?? (inspection.imageUrl || null);
    }, [uploadedUrl, inspection.imageUrl]);

    const storedImageUrl = useMemo(() => {
        return (inspection.imageUrl || uploadedUrl || previewUrl) || null;
    }, [inspection.imageUrl, uploadedUrl, previewUrl]);

    const baselineForWeather = (weather?: string | null) => {
        if (!transformer) return null;
        switch (weather) {
            case "sunny":
                return transformer.sunnyImage || null;
            case "cloudy":
                return transformer.cloudyImage || null;
            case "rainy":
                // Map rainy to windy baseline if rainy is not modeled; adjust if needed
                return transformer.windyImage || null;
            default:
                return transformer.sunnyImage || transformer.cloudyImage || transformer.windyImage || null;
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
        let boxes: number[][] = [];
        try {
            const raw = typeof inspection.boundingBoxes === 'string'
                ? JSON.parse(inspection.boundingBoxes)
                : (inspection.boundingBoxes as any);
            if (Array.isArray(raw)) {
                if (raw.length === 0) boxes = [];
                else if (Array.isArray(raw[0])) boxes = raw as number[][];
                else {
                    // flat array assumed [x,y,w,h, x,y,w,h, ...]
                    const flat = raw as number[];
                    for (let i = 0; i + 3 < flat.length; i += 4) {
                        boxes.push([flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]);
                    }
                }
            }
            setStoredBoxes(boxes);
        } catch (e) { 
            setStoredBoxes([]); 
            boxes = [];
        }
        try {
            const ft = Array.isArray(inspection.faultTypes)
                ? (inspection.faultTypes as string[])
                : (typeof inspection.faultTypes === 'string' ? (JSON.parse(inspection.faultTypes) as string[]) : []);
            const finalFt = Array.isArray(ft) ? ft : [];
            setStoredFaultTypes(finalFt);

            const info: OverlayBoxInfo[] = boxes.map((box, index) => ({
                x: box[0],
                y: box[1],
                w: box[2],
                h: box[3],
                label: finalFt[index] || 'unknown',
                boxFault: finalFt[index] || 'unknown',
            }));
            setStoredBoxInfo(info);
        } catch (e) { 
            setStoredFaultTypes([]); 
            setStoredBoxInfo([]);
        }
    // Also update when boundingBoxes/faultTypes/imageUrl change on the same inspection id
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inspection.id, inspection.boundingBoxes, inspection.faultTypes, inspection.imageUrl]);

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
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg mb-6 p-6">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">Inspection Details</h2>
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
                    <label className="block text-sm font-bold text-gray-700">Inspection Number</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.inspectionNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Transformer Number</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.transformerNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Branch</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.branch}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Inspected Date</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.inspectedDate}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Maintenance Date</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.maintainanceDate || 'N/A'}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Status</label>
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
                                        <label className="block text-sm font-bold text-gray-700">Uploaded by</label>
                                        <p className="mt-1 text-sm text-gray-900">{inspection.uploadedBy}</p>
                                    </div>
                                )}
            </div>

            {/* Thermal Image Upload & Comparison */}
            <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Thermal Image</h3>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
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
                    <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Comparison</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Baseline ({selectedWeather})</p>
                                {baselineForWeather(selectedWeather) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={baselineForWeather(selectedWeather) as string} alt="Baseline" className="w-full h-56 object-contain border rounded" />
                                ) : (
                                    <div className="w-full h-56 flex flex-col gap-2 items-center justify-center border rounded text-gray-400">
                                        <span>No baseline</span>
                                        <label className="px-3 py-1 text-sm bg-black text-white rounded cursor-pointer">
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
                                <p className="text-sm text-gray-600 mb-1">Uploaded</p>
                                                                {effectiveUploadedUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={effectiveUploadedUrl as string} alt="Uploaded" className="w-full h-56 object-contain border rounded" />
                                ) : (
                                    <div className="w-full h-56 flex items-center justify-center border rounded text-gray-400">No image uploaded</div>
                                )}
                                                {(uploadedBy || uploadedAt || inspection.imageUploadedBy || inspection.imageUploadedAt) && (
                                                                    <p className="mt-1 text-xs text-gray-500">
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
                                                                    className="px-2 py-1 text-xs border rounded"
                                                                    onClick={() => {
                                                                        const allOn = overlayToggles.looseJoint && overlayToggles.pointOverload && overlayToggles.wireOverload;
                                                                        setOverlayToggles({ looseJoint: !allOn, pointOverload: !allOn, wireOverload: !allOn });
                                                                    }}
                                                                >
                                                                    {overlayToggles.looseJoint && overlayToggles.pointOverload && overlayToggles.wireOverload ? 'Show none' : 'Show all'}
                                                                </button>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={overlayToggles.looseJoint} onChange={(e) => setOverlayToggles(t => ({...t, looseJoint: e.target.checked}))} />
                                    Loose joint
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={overlayToggles.pointOverload} onChange={(e) => setOverlayToggles(t => ({...t, pointOverload: e.target.checked}))} />
                                    Point overload
                                </label>
                                <label className="flex items-center gap-2 text-sm">
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
                                        boxInfo={aiStats.boxInfo}
                                        toggles={overlayToggles}
                                        onRemoveBox={async (idx, box) => {
                                        if (!inspection.id) return;
                                        try {
                                            // Optimistically update local aiStats
                                            setAiStats((prev) => {
                                                if (!prev) return prev;
                                                const next = { ...prev } as any;
                                                if (Array.isArray(next.boxes)) {
                                                    const arr = (next.boxes as number[][]).slice();
                                                    if (box) {
                                                        const i = arr.findIndex((b) => b && b.length >= 4 && b[0] === box.x && b[1] === box.y && b[2] === box.w && b[3] === box.h);
                                                        if (i >= 0) arr.splice(i, 1); else arr.splice(idx, 1);
                                                    } else {
                                                        arr.splice(idx, 1);
                                                    }
                                                    next.boxes = arr;
                                                }
                                                if (Array.isArray(next.boxInfo)) {
                                                    const info = (next.boxInfo as OverlayBoxInfo[]).slice();
                                                    if (box) {
                                                        const i2 = info.findIndex((bi) => bi && bi.x === box.x && bi.y === box.y && bi.w === box.w && bi.h === box.h);
                                                        if (i2 >= 0) info.splice(i2, 1); else info.splice(idx, 1);
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
                                </div>
                            ) : (
                                <div className="w-full h-56 flex items-center justify-center border rounded text-gray-400">
                                    Run analysis to see overlay
                                </div>
                            )}
                            {aiStats && (
                                <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                                    {typeof aiStats.prob === 'number' && <span>p={aiStats.prob.toFixed(2)}</span>}
                                    {typeof aiStats.warmFraction === 'number' && <span>warm={aiStats.warmFraction.toFixed(3)}</span>}
                                    {typeof aiStats.dv95 === 'number' && <span>dv95={aiStats.dv95.toFixed(3)}</span>}
                                    {typeof aiStats.histDistance === 'number' && <span>histD={aiStats.histDistance.toFixed(3)}</span>}
                                </div>
                            )}
                            {/* Stored analysis display: if inspection has an imageUrl and saved boundingBoxes, show them */}
                            {(!aiStats && storedImageUrl && Array.isArray(storedBoxes) && storedBoxes.length > 0) && (
                                <div className="mt-4">
                                    <h5 className="font-semibold mb-2">Stored analysis</h5>
                                    {/* overall fault type removed; per-box labels shown on overlays */}
                                    {(() => {
                                        const boxes = storedBoxes;
                                        if (!boxes || boxes.length === 0) return null;
                                        const ft = storedFaultTypes;
                                        const boxInfo = boxes.map((b, idx) => {
                                            const faultType = ft[idx] ?? 'none';
                                            return {
                                                x: b[0], y: b[1], w: b[2], h: b[3],
                                                boxFault: faultType,
                                                label: faultType,
                                            };
                                        });
                                        return (
                                            <div className="overscroll-none overflow-hidden">
                                                <OverlayedThermal
                                                    imageUrl={storedImageUrl as string}
                                                    // no persisted dims; component infers automatically
                                                    boxes={boxes}
                                                    boxInfo={boxInfo}
                                                    toggles={{looseJoint: true, pointOverload: true, wireOverload: true}} // Force all toggles on for stored analysis
                                                onRemoveBox={async (idx, box) => {
                                                    if (!inspection.id) return;
                                                    try {
                                                        // Determine the exact index to remove from current local arrays
                                                        let matchIdx = idx;
                                                        if (box && Array.isArray(storedBoxes)) {
                                                            const i2 = storedBoxes.findIndex(b => b && b.length >= 4 && b[0] === box.x && b[1] === box.y && b[2] === box.w && b[3] === box.h);
                                                            if (i2 >= 0) matchIdx = i2;
                                                        }
                                                        // Optimistically update local stored arrays
                                                        const newBoxes = Array.isArray(storedBoxes) ? storedBoxes.slice() : [];
                                                        if (matchIdx >= 0 && matchIdx < newBoxes.length) newBoxes.splice(matchIdx, 1);
                                                        setStoredBoxes(newBoxes);
                                                        const newFT = Array.isArray(storedFaultTypes) ? storedFaultTypes.slice() : [];
                                                        if (matchIdx >= 0 && matchIdx < newFT.length) newFT.splice(matchIdx, 1);
                                                        setStoredFaultTypes(newFT);
                                                        // Persist removal precisely using coords if available
                                                        if (box) {
                                                            const params = new URLSearchParams({ x: String(box.x), y: String(box.y), w: String(box.w), h: String(box.h) });
                                                            await fetch(apiUrl(`/api/inspections/${inspection.id}/boxes?${params.toString()}`), { method: 'DELETE' });
                                                        } else {
                                                            await fetch(apiUrl(`/api/inspections/${inspection.id}/boxes/${idx}`), { method: 'DELETE' });
                                                        }
                                                        // Section hides automatically when boxes array becomes empty
                                                        // Optionally reload in background to keep context consistent
                                                        void reload();
                                                    } catch {
                                                        // no-op
                                                    }
                                                }}
                                                containerClassName="w-full border rounded overflow-hidden"
                                            />
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InspectionDetailsPanel;
