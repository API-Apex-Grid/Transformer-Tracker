
"use client";

import { Transformer } from "@/app/transformer/page";

interface TransformerListProps {
  transformers: Transformer[];
}

const TransformerList = ({ transformers }: TransformerListProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
              Region
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
              Transformer No.
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
              Pole No.
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
          </tr>
        </thead>
        <tbody>
          {transformers.map((transformer, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">
                {transformer.region}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">
                {transformer.transformerNumber}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">
                {transformer.poleNumber}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">
                {transformer.type}
              </td>
              <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-500">
                {transformer.location}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransformerList;
