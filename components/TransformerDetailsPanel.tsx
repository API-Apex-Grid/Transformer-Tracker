"use client";

import { Transformer } from "@/types/transformer";

interface TransformerDetailsPanelProps {
    transformer: Transformer;
    onClose: () => void;
}

const TransformerDetailsPanel = ({ transformer, onClose }: TransformerDetailsPanelProps) => {
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>
        </div>
    );
};

export default TransformerDetailsPanel;
