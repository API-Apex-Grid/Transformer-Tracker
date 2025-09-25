"use client";

import { useState } from "react";
import { useTransformers } from "@/context/TransformersContext";
import { Transformer } from "@/types/transformer";
import { apiUrl } from "@/lib/api";

interface AddTransformerModalProps {
  addTransformer: (transformer: Transformer) => void;
}

const AddTransformerModal = ({ addTransformer }: AddTransformerModalProps) => {
  const { transformers } = useTransformers();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // Track current step
  const [region, setRegion] = useState("");
  const [transformerNumber, setTransformerNumber] = useState("");
  const [poleNumber, setPoleNumber] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [sunnyImage, setSunnyImage] = useState<string | null>(null);
  const [cloudyImage, setCloudyImage] = useState<string | null>(null);
  const [windyImage, setWindyImage] = useState<string | null>(null);
  const hasAnyImage = !!(sunnyImage || cloudyImage || windyImage);

  const showSetTransformer = () => {
    setIsOpen(true);
    setStep(1);
  };

  const hideSetTransformer = () => {
    setIsOpen(false);
    setStep(1);
    setRegion("");
    setTransformerNumber("");
    setPoleNumber("");
    setType("");
    setLocation("");
    setSunnyImage(null);
    setCloudyImage(null);
    setWindyImage(null);
  };

  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  const isDuplicateCombo = (tfNo: string, poleNo: string) => {
    const a = tfNo.trim().toLowerCase();
    const b = poleNo.trim().toLowerCase();
    return transformers.some(t => t.transformerNumber.trim().toLowerCase() === a && t.poleNumber.trim().toLowerCase() === b);
  };

  const checkTfUniqueInDb = async (tfNo: string): Promise<boolean> => {
    if (!tfNo.trim()) return false;
    try {
  const res = await fetch(apiUrl(`/api/transformers?tf=${encodeURIComponent(tfNo)}`), { cache: 'no-store' });
      if (!res.ok) return true; // if API failed, do not block
      const data = await res.json();
      // Unique if no records found
      return !(Array.isArray(data) && data.length > 0);
    } catch {
      return true; // fail-open
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [k: string]: string } = {};
    if (!region) newErrors.region = "Region is required";
    if (!transformerNumber) newErrors.transformerNumber = "Transformer number is required";
    if (!poleNumber) newErrors.poleNumber = "Pole number is required";
    if (!type) newErrors.type = "Type is required";
    if (!newErrors.transformerNumber) {
      const unique = await checkTfUniqueInDb(transformerNumber);
      if (!unique) newErrors.transformerNumber = "This transformer number already exists";
    }
    if (!newErrors.transformerNumber && !newErrors.poleNumber && isDuplicateCombo(transformerNumber, poleNumber)) {
      newErrors.poleNumber = "A transformer with this transformer no. and pole no. already exists";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // DB-backed uniqueness check for transformer number
    const unique = await checkTfUniqueInDb(transformerNumber);
    if (!unique) {
      setErrors(prev => ({ ...prev, transformerNumber: "This transformer number already exists" }));
      return;
    }
    // Double-check duplicates at submit time
    if (isDuplicateCombo(transformerNumber, poleNumber)) {
      setErrors(prev => ({ ...prev, poleNumber: "A transformer with this transformer no. and pole no. already exists" }));
      return;
    }
    addTransformer({
      region,
      transformerNumber,
      poleNumber,
      type,
      location,
      sunnyImage,
      cloudyImage,
      windyImage
    });
    hideSetTransformer();
  };

  const handleSkip = async () => {
    // Check uniqueness as well when skipping images
    const unique = await checkTfUniqueInDb(transformerNumber);
    if (!unique) {
      setErrors(prev => ({ ...prev, transformerNumber: "This transformer number already exists" }));
      return;
    }
    // Double-check duplicates even when skipping images
    if (isDuplicateCombo(transformerNumber, poleNumber)) {
      setErrors(prev => ({ ...prev, poleNumber: "A transformer with this transformer no. and pole no. already exists" }));
      return;
    }
    addTransformer({
      region,
      transformerNumber,
      poleNumber,
      type,
      location,
      sunnyImage: null,
      cloudyImage: null,
      windyImage: null
    });
    hideSetTransformer();
  };

  const handleFileChange = (weather: string, file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        switch (weather) {
          case 'sunny':
            setSunnyImage(base64);
            break;
          case 'cloudy':
            setCloudyImage(base64);
            break;
          case 'windy':
            setWindyImage(base64);
            break;
        }
      };
      reader.readAsDataURL(file);
    } else {
      switch (weather) {
        case 'sunny':
          setSunnyImage(null);
          break;
        case 'cloudy':
          setCloudyImage(null);
          break;
        case 'windy':
          setWindyImage(null);
          break;
      }
    }
  };

  return (
    <>
      <button
        onClick={showSetTransformer}
        className="bg-black hover:bg-black/80 text-white font-bold py-2 px-4 rounded mb-4"
      >
        Add Transformer
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
                <form onSubmit={step === 1 ? handleNext : handleSubmit}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          {step === 1 ? "Add Transformer" : "Add Base Images"}
                        </h3>

                        {step === 1 ? (
                          <div className="mt-2">
                            <div className="mb-4">
                              <label
                                htmlFor="region"
                                className="block text-black text-sm font-bold mb-2"
                              >
                                Region
                              </label>
                              <select
                                id="region"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 pr-8 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white bg-no-repeat bg-right"
                                style={{
                                  backgroundImage:
                                    "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                                  backgroundPosition: "right 0.5rem center",
                                  backgroundSize: "1.5em 1.5em"
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
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                              />
                              {errors.transformerNumber && (
                                <p className="mt-1 text-sm text-red-600">{errors.transformerNumber}</p>
                              )}
                            </div>
                            <div className="mb-4">
                              <label
                                htmlFor="poleNumber"
                                className="block text-black text-sm font-bold mb-2"
                              >
                                Pole Number
                              </label>
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
                              <label
                                htmlFor="type"
                                className="block text-black text-sm font-bold mb-2"
                              >
                                Type
                              </label>
                              <select
                                id="type"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 pr-8 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white bg-no-repeat bg-right"
                                style={{
                                  backgroundImage:
                                    "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                                  backgroundPosition: "right 0.5rem center",
                                  backgroundSize: "1.5em 1.5em"
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
                              <label
                                htmlFor="location"
                                className="block text-black text-sm font-bold mb-2"
                              >
                                Location Details
                              </label>
                              <textarea
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                              ></textarea>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <p className="text-sm text-gray-600 mb-4">
                              Upload base images for different weather conditions (optional)
                            </p>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-black text-sm font-bold mb-2">
                                  Sunny Weather
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange('sunny', e.target.files?.[0] || null)}
                                  className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                                />
                                {sunnyImage && (
                                  <div className="mt-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={sunnyImage} alt="Sunny weather preview" className="w-20 h-20 object-cover rounded border" />
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => setSunnyImage(null)}
                                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-black text-sm font-bold mb-2">
                                  Cloudy Weather
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange('cloudy', e.target.files?.[0] || null)}
                                  className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                                />
                                {cloudyImage && (
                                  <div className="mt-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={cloudyImage} alt="Cloudy weather preview" className="w-20 h-20 object-cover rounded border" />
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => setCloudyImage(null)}
                                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-black text-sm font-bold mb-2">
                                  Windy Weather
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange('windy', e.target.files?.[0] || null)}
                                  className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:ring-1 focus:ring-black bg-white"
                                />
                                {windyImage && (
                                  <div className="mt-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={windyImage} alt="Windy weather preview" className="w-20 h-20 object-cover rounded border" />
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() => setWindyImage(null)}
                                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    {step === 1 ? (
                      <>
                        <button
                          type="submit"
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-black sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Next
                        </button>
                        <button
                          onClick={hideSetTransformer}
                          type="button"
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="submit"
                          disabled={!hasAnyImage}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={handleSkip}
                          type="button"
                          disabled={hasAnyImage}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Skip for now
                        </button>
                        <button
                          onClick={() => setStep(1)}
                          type="button"
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-gray-200 text-base font-medium text-black hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-black sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Back
                        </button>
                      </>
                    )}
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

export default AddTransformerModal;
