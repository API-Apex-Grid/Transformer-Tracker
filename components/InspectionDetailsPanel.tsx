"use client";

import { Inspection } from "@/types/inspection";

interface InspectionDetailsPanelProps {
    inspection: Inspection;
    onClose: () => void;
}

const InspectionDetailsPanel = ({ inspection, onClose }: InspectionDetailsPanelProps) => {
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg mb-6 p-6">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">Inspection Details</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700">Inspection Number</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.inspectionNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Transformer Number</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.transformerNumber}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Branch</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.branch}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Inspected Date</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.inspectedDate}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Maintenance Date</label>
                    <p className="mt-1 text-sm text-gray-900">{inspection.maintainanceDate || 'N/A'}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Status</label>
                    <span
                        className={`inline-block px-2 py-1 text-xs font-semibold rounded ${inspection.status === 'Pending' ? 'bg-red-100 text-red-800 border border-red-300' :
                                inspection.status === 'In Progress' ? 'bg-green-100 text-green-800 border border-green-300' :
                                    inspection.status === 'Completed' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                        'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}
                    >
                        {inspection.status}
                    </span>
                </div>
            </div>

            {/* Dummy Component Section */}
            <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Inspection Analysis</h3>
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <div className="text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-medium mb-2">Inspection Analysis Component</p>
                        <p className="text-sm">This component will be designed and implemented later.</p>
                        <p className="text-xs mt-2 text-gray-400">
                            Placeholder for detailed inspection analysis, charts, and additional inspection data.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InspectionDetailsPanel;
