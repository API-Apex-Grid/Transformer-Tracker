"use client";

import { useState } from "react";
import { useTransformers } from "@/context/TransformersContext";
import { Transformer } from "@/types/transformer";

interface TransformerListProps {
  transformers: Transformer[];
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  onView?: (index: number) => void;
}

const TransformerList = ({ transformers, onEdit, onDelete, onView }: TransformerListProps) => {
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const toggleMenu = (index: number) => {
    setOpenMenu((prev) => (prev === index ? null : index));
  };

  const closeMenu = () => setOpenMenu(null);

  const { updateTransformer } = useTransformers();

  const toggleFavourite = (index: number) => {
    const t = transformers[index];
    if (!t) return;
    const updated = { ...t, favourite: !t.favourite } as Transformer;
    updateTransformer(index, updated);
  };

  return (
    <div className="overflow-x-auto pb-24">
      <table className="min-w-full bg-white text-black table-fixed">
        <thead>
          <tr>
            <th className="px-3 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-bold uppercase tracking-wider w-10">
              {" "}
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-bold uppercase tracking-wider w-32">
              Region
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-bold uppercase tracking-wider w-48">
              Transformer No.
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-bold uppercase tracking-wider w-32">
              Pole No.
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-bold uppercase tracking-wider w-32">
              Type
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-bold uppercase tracking-wider w-[35%]">
              Location
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-center text-xs leading-4 font-bold uppercase tracking-wider w-20">
              View
            </th>
            {(onEdit || onDelete) && (
              <th className="px-6 py-3 border-b-2 border-gray-300 text-right text-xs leading-4 font-bold uppercase tracking-wider w-16">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transformers.map((transformer, index) => (
            <tr key={index}>
              <td className="px-3 py-4 align-top border-b border-gray-200 w-10">
                <button
                  aria-label={transformer.favourite ? "Unfavourite" : "Favourite"}
                  onClick={() => toggleFavourite(index)}
                  className="text-yellow-500 hover:text-yellow-600"
                  title={transformer.favourite ? "Remove from favourites" : "Add to favourites"}
                >
                  {transformer.favourite ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.787 1.401 8.168L12 18.896l-7.335 3.87 1.401-8.168L.132 9.211l8.2-1.193L12 .587z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                    </svg>
                  )}
                </button>
              </td>
              <td className="px-6 py-4 align-top whitespace-normal break-words border-b border-gray-200 w-32 min-w-0">
                {transformer.region}
              </td>
              <td className="px-6 py-4 align-top whitespace-normal break-words border-b border-gray-200 w-48 min-w-0">
                {transformer.transformerNumber}
              </td>
              <td className="px-6 py-4 align-top whitespace-normal break-words border-b border-gray-200 w-32 min-w-0">
                {transformer.poleNumber}
              </td>
              <td className="px-6 py-4 align-top whitespace-normal break-words border-b border-gray-200 w-32 min-w-0">
                {transformer.type}
              </td>
              <td className="px-6 py-4 align-top whitespace-normal break-words break-all border-b border-gray-200 w-[35%] min-w-0">
                {transformer.location}
              </td>
              <td className="px-6 py-4 align-top border-b border-gray-200 text-center w-20">
                <button
                  onClick={() => onView && onView(index)}
                  className="custombutton px-3 py-1 rounded text-sm font-medium"
                >
                  View
                </button>
              </td>
              {(onEdit || onDelete) && (
                <td className="px-6 py-4 align-top whitespace-normal break-words border-b border-gray-200 text-right relative w-16">
                  <button
                    aria-label="Actions"
                    className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 text-black"
                    onClick={() => toggleMenu(index)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                  {openMenu === index && (
                    <div className="absolute right-4 mt-2 w-28 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                      {onEdit && (
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-black"
                          onClick={() => {
                            onEdit(index);
                            closeMenu();
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => {
                            onDelete(index);
                            closeMenu();
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransformerList;
