"use client";

import { useState, useEffect } from "react";
import { Inspection } from "@/types/inspection";
import { apiUrl } from "@/lib/api";

interface AddInspectionModalProps {
  addInspection: (inspection: Inspection) => void;
  prefilledTransformerNumber?: string;
}

const AddInspectionModal = ({
  addInspection,
  prefilledTransformerNumber,
}: AddInspectionModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [transformerNumber, setTransformerNumber] = useState(
    prefilledTransformerNumber || ""
  );
  const [maintainanceDate, setMaintainanceDate] = useState("");
  const [status, setStatus] = useState("Pending");
  const [branch, setBranch] = useState("");
  const [dateOfInspection, setDateOfInspection] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Local timezone-correct YYYY-MM-DD for min date
  const todayLocal = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .split("T")[0];

  const showSetInspection = () => setIsOpen(true);
  const hideSetInspection = () => {
    setIsOpen(false);
    setMaintainanceDate("");
    setStatus("Pending");
    setTransformerNumber("");
    setBranch("");
    setDateOfInspection("");
    setTime("");
  };

  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [k: string]: string } = {};
    if (!branch) newErrors.branch = "Branch is required";
    if (!transformerNumber)
      newErrors.transformerNumber = "Transformer number is required";
    if (!dateOfInspection)
      newErrors.dateOfInspection = "Date of inspection is required";
    if (!time) newErrors.time = "Time is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);

    // Check that transformer exists before proceeding
    try {
      const res = await fetch(
        apiUrl(`/api/transformers?tf=${encodeURIComponent(transformerNumber)}`),
        { cache: "no-store" }
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
      // If the check fails due to network, still block to be safe
      setErrors((prev) => ({
        ...prev,
        transformerNumber: "Could not verify transformer. Try again.",
      }));
      setSubmitting(false);
      return;
    }

    // Auto-generate inspection number
    const autoInspectionNumber = `INS-${Date.now()}`;

    // Concatenate date and time for inspectedDate
    const combinedInspectedDate = `${dateOfInspection} ${time}`;

    try {
      await addInspection({
        inspectionNumber: autoInspectionNumber,
        inspectedDate: combinedInspectedDate,
        maintainanceDate,
        status,
        transformerNumber,
        branch,
      });
      hideSetInspection();
    } catch (err) {
      const msg =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Failed to add inspection";
      setErrors((prev) => ({ ...prev, transformerNumber: msg }));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (prefilledTransformerNumber) {
      setTransformerNumber(prefilledTransformerNumber);
    }
  }, [prefilledTransformerNumber]);

  return (
    <>
      <button
        onClick={showSetInspection}
        className="custombutton font-bold py-2 px-4 rounded mb-4"
      >
        Add Inspection
      </button>

      {isOpen && (
        <div
          className="relative z-10"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <form onSubmit={handleSubmit}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                        <h3
                          className="text-lg leading-6 font-medium text-gray-900"
                          id="modal-headline"
                        >
                          Add Inspection
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
                              onChange={(e) =>
                                setTransformerNumber(e.target.value)
                              }
                              disabled={!!prefilledTransformerNumber}
                              className={`shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white ${
                                prefilledTransformerNumber
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                            />
                            {errors.transformerNumber && (
                              <p className="mt-1 text-sm text-red-600">
                                {errors.transformerNumber}
                              </p>
                            )}
                          </div>
                          <div>
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
                                onChange={(e) =>
                                  setDateOfInspection(e.target.value)
                                }
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
                      {submitting ? "Saving..." : "Confirm"}
                    </button>
                    <button
                      onClick={hideSetInspection}
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
      )}
    </>
  );
};

export default AddInspectionModal;
