"use client";

import { useEffect, useState } from "react";
import { Inspection } from "@/types/inspection";
import { apiUrl, authHeaders } from "@/lib/api";

interface EditInspectionModalProps {
  isOpen: boolean;
  initial: Inspection | null;
  onClose: () => void;
  onSave: (updated: Inspection) => void;
}

const EditInspectionModal = ({
  isOpen,
  initial,
  onClose,
  onSave,
}: EditInspectionModalProps) => {
  const [transformerNumber, setTransformerNumber] = useState("");
  const [maintainanceDate, setMaintainanceDate] = useState("");
  const [status, setStatus] = useState("Pending");
  const [branch, setBranch] = useState("");
  const [dateOfInspection, setDateOfInspection] = useState("");
  const [time, setTime] = useState("");
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const todayLocal = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .split("T")[0];

  useEffect(() => {
    if (initial) {
      setBranch(initial.branch || "");
      setTransformerNumber(initial.transformerNumber || "");
      const [datePart, timePart] = initial.inspectedDate.split(" ");
      setDateOfInspection(datePart || "");
      setTime(timePart || "");
      setMaintainanceDate(initial.maintainanceDate || "");
      setStatus(initial.status || "Pending");
    }
  }, [initial, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [k: string]: string } = {};
    if (!branch) newErrors.branch = "Branch is required";
    if (!transformerNumber)
      newErrors.transformerNumber = "Transformer number is required";
    if (!dateOfInspection)
      newErrors.dateOfInspection = "Date of inspection is required";
    if (!time) newErrors.time = "Time is required";
    if (status === "Completed" && !maintainanceDate)
      newErrors.maintainanceDate =
        "Maintenance date is required if status is Completed";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);

    // Ensure transformer exists before saving
    try {
      const res = await fetch(
        apiUrl(`/api/transformers?tf=${encodeURIComponent(transformerNumber)}`),
        { cache: "no-store", headers: authHeaders() }
      );
      let exists = false;
      if (res.ok) {
        const list: Array<{ transformerNumber?: string }> = await res.json();
        if (Array.isArray(list)) {
          exists = list.some((t) => t.transformerNumber === transformerNumber);
        }
      }
      if (!exists) {
        setErrors((prev) => ({
          ...prev,
          transformerNumber: "Transformer does not exist",
        }));
        setSubmitting(false);
        return;
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        transformerNumber: "Could not verify transformer. Try again.",
      }));
      setSubmitting(false);
      return;
    }

    const combinedInspectedDate = `${dateOfInspection} ${time}`;

    try {
      await onSave({
        inspectionNumber: initial?.inspectionNumber || "",
        transformerNumber,
        inspectedDate: combinedInspectedDate,
        maintainanceDate: status === "Completed" ? maintainanceDate : "",
        status,
        branch,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !initial) return null;

  return (
    <div className="relative z-50" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-gray-500/75" onClick={onClose} />
      <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <form onSubmit={handleSubmit}>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-black">
                      Edit Inspection
                    </h3>
                    <div className="mt-2">
                      <div className="mb-4">
                        <label
                          htmlFor="branch"
                          className="block text-black text-sm font-bold mb-2"
                        >
                          Branch
                        </label>
                        <input
                          type="text"
                          id="branch"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                        />
                        {errors.branch && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.branch}
                          </p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label
                          htmlFor="transformerNumber"
                          className="block text-black text-sm font-bold mb-2"
                        >
                          Transformer Number
                        </label>
                        <input
                          type="text"
                          id="transformerNumber"
                          value={transformerNumber}
                          disabled={true}
                          // onChange={(e) => setTransformerNumber(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white cursor-not-allowed"
                        />
                        {errors.transformerNumber && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.transformerNumber}
                          </p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label
                          htmlFor="dateOfInspection"
                          className="block text-black text-sm font-bold mb-2"
                        >
                          Date of Inspection
                        </label>
                        <input
                          type="date"
                          id="dateOfInspection"
                          value={dateOfInspection}
                          onChange={(e) => setDateOfInspection(e.target.value)}
                          min={todayLocal}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                        />
                        {errors.dateOfInspection && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.dateOfInspection}
                          </p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label
                          htmlFor="time"
                          className="block text-black text-sm font-bold mb-2"
                        >
                          Time
                        </label>
                        <input
                          type="time"
                          id="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                        />
                        {errors.time && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.time}
                          </p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label
                          htmlFor="maintainanceDate"
                          className="block text-black text-sm font-bold mb-2"
                        >
                          Maintenance Date
                        </label>
                        <input
                          type="date"
                          id="maintainanceDate"
                          value={maintainanceDate}
                          min={todayLocal}
                          onChange={(e) => setMaintainanceDate(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                        />
                        {errors.maintainanceDate && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.maintainanceDate}
                          </p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label
                          htmlFor="status"
                          className="block text-black text-sm font-bold mb-2"
                        >
                          Status
                        </label>
                        <select
                          id="status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 pr-8 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white bg-no-repeat bg-right"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                          }}
                        >
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                        </select>
                        <div className="mt-2">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                              status === "Pending"
                                ? "bg-red-100 text-red-800 border border-red-300"
                                : status === "In Progress"
                                ? "bg-green-100 text-green-800 border border-green-300"
                                : status === "Completed"
                                ? "bg-purple-100 text-purple-800 border border-purple-300"
                                : "bg-gray-100 text-gray-800 border border-gray-300"
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-black/80 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-black sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={onClose}
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditInspectionModal;
