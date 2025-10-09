"use client";

import { Transformer } from "@/types/transformer";
import { useState } from "react";

interface TransformerDetailsPanelProps {
  transformer: Transformer;
  onClose: () => void;
  onUpdateTransformer?: (updatedTransformer: Transformer) => void;
}

const TransformerDetailsPanel = ({
  transformer,
  onClose,
  onUpdateTransformer,
}: TransformerDetailsPanelProps) => {
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [editingWeather, setEditingWeather] = useState<string | null>(null);

  const baselineImages = {
    sunny: transformer.sunnyImage || null,
    cloudy: transformer.cloudyImage || null,
    windy: transformer.windyImage || null,
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
    const uploadedAtKey = `${weather}ImageUploadedAt` as keyof Transformer;
    const patch: Partial<Transformer> = {
      [imageKey]: null,
      [uploaderKey]: null,
      [uploadedAtKey]: null,
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
        const uploadedAtKey = `${weather}ImageUploadedAt` as keyof Transformer;
        const patch: Partial<Transformer> = {
          [imageKey]: base64,
        } as Partial<Transformer>;
        try {
          const username =
            typeof window !== "undefined"
              ? localStorage.getItem("username")
              : null;
          (patch as Record<string, unknown>)[uploaderKey as string] =
            username || null;
          (patch as Record<string, unknown>)[uploadedAtKey as string] =
            new Date().toISOString();
        } catch {
          // ignore
        }

        if (onUpdateTransformer) {
          onUpdateTransformer({ ...transformer, ...patch });
        }

        console.log(
          `Updated ${weather} image for transformer ${transformer.transformerNumber}`
        );
      };
      reader.readAsDataURL(file);
    }
    setEditingWeather(null);
  };

  return (
    <div className="details-panel bg-white text-gray-900 border border-gray-200 rounded-lg shadow-lg mb-6 p-6 transition-colors dark:bg-[#101010] dark:text-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold">Transformer Details</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-bold">Region</label>
          <p className="mt-1 text-sm">{transformer.region}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Transformer Number</label>
          <p className="mt-1 text-sm">{transformer.transformerNumber}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Pole Number</label>
          <p className="mt-1 text-sm">{transformer.poleNumber}</p>
        </div>
        <div>
          <label className="block text-sm font-bold">Type</label>
          <p className="mt-1 text-sm">{transformer.type}</p>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-bold">Location</label>
          <p className="mt-1 text-sm">{transformer.location}</p>
        </div>
        {transformer.uploadedBy && (
          <div className="col-span-2">
            <label className="block text-sm font-bold">Uploaded by</label>
            <p className="mt-1 text-sm">{transformer.uploadedBy}</p>
          </div>
        )}
      </div>

      {/* Baseline Images Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Baseline Images</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["sunny", "cloudy", "windy"].map((weather) => (
            <div
              key={weather}
              className="details-panel border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium capitalize">{weather} Weather</h4>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded ${
                    baselineImages[weather as keyof typeof baselineImages]
                      ? "weatheravailable"
                      : "weathernotavailable"
                  }`}
                >
                  {baselineImages[weather as keyof typeof baselineImages]
                    ? "Available"
                    : "Not Available"}
                </span>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                {baselineImages[weather as keyof typeof baselineImages] && (
                  <button
                    onClick={() => handleViewImage(weather)}
                    className="flex items-center gap-1 px-3 py-1 text-sm rounded viewbutton"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View
                  </button>
                )}

                <button
                  onClick={() => handleUpdateImage(weather)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded updatebutton"
                >
                  {baselineImages[weather as keyof typeof baselineImages]
                    ? "Update"
                    : "Add"}
                </button>
                {baselineImages[weather as keyof typeof baselineImages] && (
                  <button
                    onClick={() => handleRemoveImage(weather)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded removebutton"
                  >
                    Remove
                  </button>
                )}
                {weather === "sunny" &&
                  (transformer.sunnyImageUploadedBy ||
                    transformer.sunnyImageUploadedAt) && (
                    <span className="text-xs text-gray-500">
                      by {transformer.sunnyImageUploadedBy || "unknown"}
                      {transformer.sunnyImageUploadedAt
                        ? ` on ${new Date(
                            transformer.sunnyImageUploadedAt
                          ).toLocaleString()}`
                        : ""}
                    </span>
                  )}
                {weather === "cloudy" &&
                  (transformer.cloudyImageUploadedBy ||
                    transformer.cloudyImageUploadedAt) && (
                    <span className="text-xs text-gray-500">
                      by {transformer.cloudyImageUploadedBy || "unknown"}
                      {transformer.cloudyImageUploadedAt
                        ? ` on ${new Date(
                            transformer.cloudyImageUploadedAt
                          ).toLocaleString()}`
                        : ""}
                    </span>
                  )}
                {weather === "windy" &&
                  (transformer.windyImageUploadedBy ||
                    transformer.windyImageUploadedAt) && (
                    <span className="text-xs text-gray-500">
                      by {transformer.windyImageUploadedBy || "unknown"}
                      {transformer.windyImageUploadedAt
                        ? ` on ${new Date(
                            transformer.windyImageUploadedAt
                          ).toLocaleString()}`
                        : ""}
                    </span>
                  )}
              </div>

              {editingWeather === weather && (
                <div className="mt-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleFileChange(weather, e.target.files?.[0] || null)
                    }
                    className={`text-sm border rounded w-full py-1 px-2
                                                                                    file:mr-3 file:px-3 file:py-1 file:rounded-md file:border-0 file:bg-black dark:file:bg-white file:text-white dark:file:text-black file:hover:bg-black/80 dark:file:hover:bg-white/80
                                                                                    text-gray-400`}
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
          <div className="details-panel bg-white dark:bg-[#111] rounded-lg p-4 max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold capitalize text-gray-900 dark:text-white">
                {viewingImage} Weather Baseline
              </h3>
              <button
                onClick={() => setViewingImage(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex flex-col items-center justify-center">
              {baselineImages[viewingImage as keyof typeof baselineImages] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    baselineImages[
                      viewingImage as keyof typeof baselineImages
                    ] as string
                  }
                  alt={`${viewingImage} weather baseline`}
                  className="max-w-full max-h-96 object-contain rounded"
                />
              ) : (
                <div className="bg-gray-100 p-8 rounded text-center">
                  <p className="text-gray-500">No image available</p>
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                {viewingImage === "sunny" &&
                  (transformer.sunnyImageUploadedBy ||
                    transformer.sunnyImageUploadedAt) && (
                    <span>
                      by {transformer.sunnyImageUploadedBy || "unknown"}
                      {transformer.sunnyImageUploadedAt
                        ? ` on ${new Date(
                            transformer.sunnyImageUploadedAt
                          ).toLocaleString()}`
                        : ""}
                    </span>
                  )}
                {viewingImage === "cloudy" &&
                  (transformer.cloudyImageUploadedBy ||
                    transformer.cloudyImageUploadedAt) && (
                    <span>
                      by {transformer.cloudyImageUploadedBy || "unknown"}
                      {transformer.cloudyImageUploadedAt
                        ? ` on ${new Date(
                            transformer.cloudyImageUploadedAt
                          ).toLocaleString()}`
                        : ""}
                    </span>
                  )}
                {viewingImage === "windy" &&
                  (transformer.windyImageUploadedBy ||
                    transformer.windyImageUploadedAt) && (
                    <span>
                      by {transformer.windyImageUploadedBy || "unknown"}
                      {transformer.windyImageUploadedAt
                        ? ` on ${new Date(
                            transformer.windyImageUploadedAt
                          ).toLocaleString()}`
                        : ""}
                    </span>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformerDetailsPanel;
