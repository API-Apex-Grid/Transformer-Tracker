"use client";

import { useEffect, useState } from "react";
import { Transformer } from "@/types/transformer";

interface EditTransformerModalProps {
  isOpen: boolean;
  initial: Transformer | null;
  onClose: () => void;
  onSave: (updated: Transformer) => void;
}

const EditTransformerModal = ({ isOpen, initial, onClose, onSave }: EditTransformerModalProps) => {
  const [region, setRegion] = useState("");
  const [transformerNumber, setTransformerNumber] = useState("");
  const [poleNumber, setPoleNumber] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  useEffect(() => {
    if (initial) {
      setRegion(initial.region || "");
      setTransformerNumber(initial.transformerNumber || "");
      setPoleNumber(initial.poleNumber || "");
      setType(initial.type || "");
      setLocation(initial.location || "");
    }
  }, [initial, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [k: string]: string } = {};
    if (!region) newErrors.region = "Region is required";
    if (!transformerNumber) newErrors.transformerNumber = "Transformer number is required";
    if (!poleNumber) newErrors.poleNumber = "Pole number is required";
    if (!type) newErrors.type = "Type is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    onSave({ region, transformerNumber, poleNumber, type, location });
    onClose();
  };

  if (!isOpen || !initial) return null;

  return (
    <div className="relative z-50" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-gray-500/75" onClick={onClose} />
      <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
          >
            <form onSubmit={handleSubmit}>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-black">Edit Transformer</h3>
                    <div className="mt-2">
                      <div className="mb-4">
                        <label htmlFor="region" className="block text-black text-sm font-bold mb-2">Region</label>
                        <select
                          id="region"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 pr-8 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white bg-no-repeat bg-right"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                          }}
                        >
                          <option value="" disabled>
                            Select a region
                          </option>
                          <option>Anuradhapura</option>
                          <option>Colombo</option>
                          <option>Trincomalee</option>
                          <option>Jaffna</option>
                          <option>Kandy</option>
                          <option>Galle</option>
                        </select>
                        {errors.region && (
                          <p className="mt-1 text-sm text-red-600">{errors.region}</p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label htmlFor="transformerNumber" className="block text-black text-sm font-bold mb-2">Transformer Number</label>
                        <input
                          type="text"
                          id="transformerNumber"
                          value={transformerNumber}
                          onChange={(e) => setTransformerNumber(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                        />
                        {errors.transformerNumber && (
                          <p className="mt-1 text-sm text-red-600">{errors.transformerNumber}</p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label htmlFor="poleNumber" className="block text-black text-sm font-bold mb-2">Pole Number</label>
                        <input
                          type="text"
                          id="poleNumber"
                          value={poleNumber}
                          onChange={(e) => setPoleNumber(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                        />
                        {errors.poleNumber && (
                          <p className="mt-1 text-sm text-red-600">{errors.poleNumber}</p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label htmlFor="type" className="block text-black text-sm font-bold mb-2">Type</label>
                        <select
                          id="type"
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 pr-8 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white bg-no-repeat bg-right"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                          }}
                        >
                          <option value="" disabled>
                            Select a type
                          </option>
                          <option>Distribution</option>
                          <option>Bulk</option>
                        </select>
                        {errors.type && (
                          <p className="mt-1 text-sm text-red-600">{errors.type}</p>
                        )}
                      </div>
                      <div className="mb-4">
                        <label htmlFor="location" className="block text-black text-sm font-bold mb-2">Location Details</label>
                        <textarea
                          id="location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-black sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={onClose}
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTransformerModal;
