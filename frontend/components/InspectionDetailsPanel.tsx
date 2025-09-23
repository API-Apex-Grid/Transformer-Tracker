"use client";

import { Inspection } from "@/types/inspection";
import ThermalImage from "@/components/ThermalImage";
import { useTransformers } from "@/context/TransformersContext";
import { useInspections } from "@/context/InspectionsContext";
import { useState, useMemo } from "react";
import { apiUrl } from "@/lib/api";

interface InspectionDetailsPanelProps {
    inspection: Inspection;
    onClose: () => void;
}

const InspectionDetailsPanel = ({ inspection, onClose }: InspectionDetailsPanelProps) => {
    const { transformers, reload: reloadTransformers } = useTransformers();
    const { reload } = useInspections();
    const [selectedWeather, setSelectedWeather] = useState<string>(inspection.weather || "sunny");
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(inspection.imageUrl || null);
    const [uploadedAt, setUploadedAt] = useState<string | null>(inspection.imageUploadedAt || null);
    const [uploadedBy, setUploadedBy] = useState<string | null>(inspection.imageUploadedBy || null);
    const [aiAnnotated, setAiAnnotated] = useState<string | null>(null);
    const [aiStats, setAiStats] = useState<{ prob?: number; histDistance?: number; dv95?: number; warmFraction?: number; boxes?: number[][] | number[] } | null>(null);

    const transformer = useMemo(() => (
        transformers.find(t => t.transformerNumber === inspection.transformerNumber)
    ), [transformers, inspection.transformerNumber]);

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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Thermal Image</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Uploader */}
                    <ThermalImage
                        onImageUpload={(file) => handleUpload(file, selectedWeather)}
                        onWeatherChange={(w) => setSelectedWeather(w)}
                        onAnalyze={() => { /* handled inside component */ }}
                        inspectionId={inspection.id as string}
                        onAnalysisResult={(res) => {
                            setAiAnnotated(res.annotated || null);
                            setAiStats({
                                prob: res.prob,
                                histDistance: res.histDistance,
                                dv95: res.dv95,
                                warmFraction: res.warmFraction,
                                boxes: res.boxes as number[][] | number[]
                            });
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
                                                                {(uploadedUrl || inspection.imageUrl) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={(uploadedUrl || inspection.imageUrl) as string} alt="Uploaded" className="w-full h-56 object-contain border rounded" />
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
                        {/* Annotated output below */}
                        <div className="mt-4">
                            <p className="text-sm text-gray-600 mb-1">AI Annotated</p>
                            {aiAnnotated ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={aiAnnotated} alt="Annotated" className="w-full h-56 object-contain border rounded" />
                                    {aiStats && (
                                        <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                                            {typeof aiStats.prob === 'number' && <span>p={aiStats.prob.toFixed(2)}</span>}
                                            {typeof aiStats.warmFraction === 'number' && <span>warm={aiStats.warmFraction.toFixed(3)}</span>}
                                            {typeof aiStats.dv95 === 'number' && <span>dv95={aiStats.dv95.toFixed(3)}</span>}
                                            {typeof aiStats.histDistance === 'number' && <span>histD={aiStats.histDistance.toFixed(3)}</span>}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full h-56 flex items-center justify-center border rounded text-gray-400">
                                    Run analysis to see annotated image
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
