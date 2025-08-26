"use client";

import { Transformer } from "@/types/transformer";
import { useState } from "react";

interface TransformerDetailsPanelProps {
    transformer: Transformer;
    onClose: () => void;
    onUpdateTransformer?: (updatedTransformer: Transformer) => void;
}

const TransformerDetailsPanel = ({ transformer, onClose, onUpdateTransformer }: TransformerDetailsPanelProps) => {
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [editingWeather, setEditingWeather] = useState<string | null>(null);

    const baselineImages = {
        sunny: transformer.sunnyImage || null,
        cloudy: transformer.cloudyImage || null,
        windy: transformer.windyImage || null
    };

    const handleViewImage = (weather: string) => {
        setViewingImage(weather);
    };

    const handleUpdateImage = (weather: string) => {
        setEditingWeather(weather);
    };

        const handleRemoveImage = (weather: string) => {
            // Clear the selected baseline image and its uploader
            const imageKey = `${weather}Image` as keyof Transformer;
            const uploaderKey = `${weather}ImageUploadedBy` as keyof Transformer;
            const patch: Partial<Transformer> = {
                [imageKey]: null,
                [uploaderKey]: null,
            } as Partial<Transformer>;
            if (onUpdateTransformer) {
                onUpdateTransformer({ ...transformer, ...patch });
            }
        };

    const handleFileChange = (weather: string, file: File | null) => {
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;

                // Update the transformer with the new image
                const imageKey = `${weather}Image` as keyof Transformer;
                const uploaderKey = `${weather}ImageUploadedBy` as keyof Transformer;
                const patch: Partial<Transformer> = { [imageKey]: base64 } as Partial<Transformer>;
                try {
                    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
                    (patch as Record<string, unknown>)[uploaderKey as string] = username || null;
                } catch {
                    // ignore
                }

                if (onUpdateTransformer) {
                    onUpdateTransformer({ ...transformer, ...patch });
                }

                console.log(`Updated ${weather} image for transformer ${transformer.transformerNumber}`);
            };
            reader.readAsDataURL(file);
        }
        setEditingWeather(null);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg mb-6 p-6">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">Transformer Details</h2>
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
                    <label className="block text-sm font-bold text-gray-700">Region</label>
                    <p className="mt-1 text-sm text-gray-900">{transformer.region}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Transformer Number</label>
                    <p className="mt-1 text-sm text-gray-900">{transformer.transformerNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Pole Number</label>
                    <p className="mt-1 text-sm text-gray-900">{transformer.poleNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Type</label>
                    <p className="mt-1 text-sm text-gray-900">{transformer.type}</p>
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-bold text-gray-700">Location</label>
                    <p className="mt-1 text-sm text-gray-900">{transformer.location}</p>
                </div>
                                {transformer.uploadedBy && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-gray-700">Uploaded by</label>
                                        <p className="mt-1 text-sm text-gray-900">{transformer.uploadedBy}</p>
                                    </div>
                                )}
            </div>

            {/* Baseline Images Section */}
            <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Baseline Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['sunny', 'cloudy', 'windy'].map((weather) => (
                        <div key={weather} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900 capitalize">{weather} Weather</h4>
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${baselineImages[weather as keyof typeof baselineImages]
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}>
                                    {baselineImages[weather as keyof typeof baselineImages] ? 'Available' : 'Not Available'}
                                </span>
                            </div>

                            <div className="flex gap-2 items-center">
                                {baselineImages[weather as keyof typeof baselineImages] && (
                                    <button
                                        onClick={() => handleViewImage(weather)}
                                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        View
                                    </button>
                                )}

                                <button
                                    onClick={() => handleUpdateImage(weather)}
                                    className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                                >
                                    {baselineImages[weather as keyof typeof baselineImages] ? 'Update' : 'Add'}
                                </button>
                                                            {baselineImages[weather as keyof typeof baselineImages] && (
                                                                <button
                                                                    onClick={() => handleRemoveImage(weather)}
                                                                    className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                                {weather === 'sunny' && transformer.sunnyImageUploadedBy && (
                                                                    <span className="text-xs text-gray-500">by {transformer.sunnyImageUploadedBy}</span>
                                                                )}
                                                                {weather === 'cloudy' && transformer.cloudyImageUploadedBy && (
                                                                    <span className="text-xs text-gray-500">by {transformer.cloudyImageUploadedBy}</span>
                                                                )}
                                                                {weather === 'windy' && transformer.windyImageUploadedBy && (
                                                                    <span className="text-xs text-gray-500">by {transformer.windyImageUploadedBy}</span>
                                                                )}
                            </div>

                            {editingWeather === weather && (
                                <div className="mt-3">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(weather, e.target.files?.[0] || null)}
                                        className="text-sm border rounded w-full py-1 px-2"
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => setEditingWeather(null)}
                                            className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Image Viewer Modal */}
            {viewingImage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[80vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold capitalize">{viewingImage} Weather Baseline</h3>
                            <button
                                onClick={() => setViewingImage(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex justify-center">
                            {baselineImages[viewingImage as keyof typeof baselineImages] ? (
                                <img
                                    src={baselineImages[viewingImage as keyof typeof baselineImages] as string}
                                    alt={`${viewingImage} weather baseline`}
                                    className="max-w-full max-h-96 object-contain rounded"
                                />
                            ) : (
                                <div className="bg-gray-100 p-8 rounded text-center">
                                    <p className="text-gray-500">No image available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransformerDetailsPanel;
