"use client";

import { Transformer } from "@/types/transformer";
import { MaintenanceRecord } from "@/types/maintenance-record";
import { apiUrl, authHeaders } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const baselineImages = {
    sunny: transformer.sunnyImage || null,
    cloudy: transformer.cloudyImage || null,
    windy: transformer.windyImage || null,
  };

  const canLoadMaintenance = Boolean(transformer.id || transformer.transformerNumber);

  const resolveSelectableId = (record: MaintenanceRecord | null | undefined) => {
    if (!record) return null;
    return record.id ?? record.inspectionId ?? record.timestamp ?? null;
  };

  const recordKey = (record: MaintenanceRecord) => {
    if (record.id) return record.id;
    if (record.inspectionId && record.timestamp) {
      return `${record.inspectionId}-${record.timestamp}`;
    }
    if (record.timestamp) return record.timestamp;
    if (record.inspectionId) return record.inspectionId;
    return `record-${record.inspectorName ?? "unknown"}`;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const selectedRecord = useMemo(() => {
    if (!maintenanceRecords.length) return null;
    if (!selectedRecordId) return maintenanceRecords[0];
    return (
      maintenanceRecords.find(
        (record) => resolveSelectableId(record) === selectedRecordId
      ) ?? maintenanceRecords[0]
    );
  }, [maintenanceRecords, selectedRecordId]);

  const highlightedRecordId = selectedRecordId ?? resolveSelectableId(selectedRecord);

  const fetchMaintenanceRecords = useCallback(async () => {
    if (!canLoadMaintenance) {
      setMaintenanceRecords([]);
      setMaintenanceError("Transformer identifier unavailable.");
      return;
    }
    const identifier = encodeURIComponent(
      transformer.id ?? transformer.transformerNumber ?? ""
    );
    setMaintenanceLoading(true);
    setMaintenanceError(null);
    try {
      const response = await fetch(
        apiUrl(`/api/transformers/${identifier}/maintenance-records`),
        {
          headers: authHeaders(),
          cache: "no-store",
        }
      );
      if (response.status === 404) {
        setMaintenanceRecords([]);
        setMaintenanceError("No maintenance records found for this transformer.");
        setSelectedRecordId(null);
        return;
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          text || `Failed to load maintenance records (${response.status})`
        );
      }
      const payload = (await response.json()) as MaintenanceRecord[];
      setMaintenanceRecords(Array.isArray(payload) ? payload : []);
      setSelectedRecordId((prev) => {
        if (!payload.length) return null;
        if (
          prev &&
          payload.some((record) => resolveSelectableId(record) === prev)
        ) {
          return prev;
        }
        return resolveSelectableId(payload[0]) ?? null;
      });
      if (!payload.length) {
        setMaintenanceError("No maintenance records found for this transformer.");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load maintenance records.";
      setMaintenanceError(message);
      setMaintenanceRecords([]);
      setSelectedRecordId(null);
    } finally {
      setMaintenanceLoading(false);
    }
  }, [canLoadMaintenance, transformer.id, transformer.transformerNumber]);

  useEffect(() => {
    if (showMaintenanceModal) {
      void fetchMaintenanceRecords();
    }
  }, [showMaintenanceModal, fetchMaintenanceRecords]);

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

  const openMaintenanceRecords = () => {
    if (!canLoadMaintenance) return;
    setShowMaintenanceModal(true);
  };

  const closeMaintenanceRecords = () => {
    setShowMaintenanceModal(false);
  };

  const handleSelectRecord = (record: MaintenanceRecord) => {
    setSelectedRecordId(resolveSelectableId(record));
  };

  return (
    <div className="details-panel bg-white text-gray-900 border border-gray-200 rounded-lg shadow-lg mb-6 p-6 transition-colors dark:bg-[#101010] dark:text-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-start mb-4 gap-4 flex-wrap">
        <h2 className="text-xl font-bold">Transformer Details</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={openMaintenanceRecords}
            disabled={!canLoadMaintenance}
            className="inline-flex items-center gap-2 px-3 py-1 text-sm border rounded custombutton disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              canLoadMaintenance
                ? "View maintenance records for this transformer"
                : "Maintenance records unavailable without transformer ID"
            }
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M3 4h18v4H3z" />
              <path d="M7 12h10" />
              <path d="M7 16h6" />
              <path d="M5 8v12h14V8" />
            </svg>
            <span>View maintenance records</span>
          </button>
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

        {showMaintenanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="details-panel bg-white dark:bg-[#111] rounded-lg p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Maintenance Records
                  </h3>
                  <p className="text-sm text-gray-500">
                    Transformer {transformer.transformerNumber || "—"}
                  </p>
                </div>
                <button
                  onClick={closeMaintenanceRecords}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {maintenanceLoading ? (
                <p className="text-sm text-gray-500">Loading maintenance records…</p>
              ) : maintenanceError ? (
                <p className="text-sm text-red-600">{maintenanceError}</p>
              ) : maintenanceRecords.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No maintenance records exist yet for this transformer.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {maintenanceRecords.map((record) => {
                      const key = recordKey(record);
                      const resolvedId = resolveSelectableId(record);
                      const isActive =
                        resolvedId && resolvedId === highlightedRecordId;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSelectRecord(record)}
                          className={`w-full text-left border rounded-md px-3 py-2 transition-colors ${
                            isActive
                              ? "bg-black text-white border-black dark:bg-white dark:text-black"
                              : "bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <p className="text-sm font-semibold">
                            {formatDate(record.timestamp)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Inspector: {record.inspectorName || "—"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Status: {record.status || "—"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="md:col-span-2 border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-[#0f0f0f]">
                    {selectedRecord ? (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Inspection ID
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {selectedRecord.inspectionId || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Inspection date
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {formatDate(selectedRecord.inspectionDate)}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Recorded at
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {formatDate(selectedRecord.timestamp)}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Inspector
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {selectedRecord.inspectorName || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Status
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {selectedRecord.status || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Transformer
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {selectedRecord.transformerName || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Voltage (V)
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {selectedRecord.voltage ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Current (A)
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {selectedRecord.current ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                              Efficiency
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">
                              {selectedRecord.efficiency ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-600 dark:text-gray-300">
                            Recommendation
                          </p>
                          <p className="text-gray-900 dark:text-gray-100 whitespace-pre-line">
                            {selectedRecord.recommendation || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-600 dark:text-gray-300">
                            Remarks
                          </p>
                          <p className="text-gray-900 dark:text-gray-100 whitespace-pre-line">
                            {selectedRecord.remarks || "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Select a record to view its details.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
