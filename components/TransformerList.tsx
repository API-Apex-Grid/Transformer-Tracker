
"use client";

import { useState } from "react";
import { Transformer } from "@/types/transformer";

interface TransformerListProps {
  transformers: Transformer[];
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const TransformerList = ({ transformers, onEdit, onDelete }: TransformerListProps) => {
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const toggleMenu = (index: number) => {
    setOpenMenu((prev) => (prev === index ? null : index));
  };

  const closeMenu = () => setOpenMenu(null);

  return (
  <div className="overflow-x-auto pb-24">
      <table className="min-w-full bg-white text-black">
        <thead>
          <tr>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium uppercase tracking-wider">
              Region
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium uppercase tracking-wider">
              Transformer No.
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium uppercase tracking-wider">
              Pole No.
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium uppercase tracking-wider">
              Location
            </th>
            {(onEdit || onDelete) && (
              <th className="px-6 py-3 border-b-2 border-gray-300 text-right text-xs leading-4 font-medium uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transformers.map((transformer, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                {transformer.region}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                {transformer.transformerNumber}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                {transformer.poleNumber}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                {transformer.type}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                {transformer.location}
              </td>
              {(onEdit || onDelete) && (
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-200 text-right relative">
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
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-black"
                      onClick={() => {
      onEdit && onEdit(index);
                        closeMenu();
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      onClick={() => {
      onDelete && onDelete(index);
                        closeMenu();
                      }}
                    >
                      Delete
                    </button>
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
