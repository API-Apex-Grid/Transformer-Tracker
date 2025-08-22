
"use client";

import React, { useState } from "react";

const inspectionDetails = {
	transformerNo: "AZ-8370",
	poleNo: "EN-122-A",
	branch: "Nugegoda",
	inspectedBy: "A-110",
	lastUpdated: "Mon(21), May, 2023 12.55pm",
	status: "In progress",
	inspectionId: "000123589",
	inspectionDate: "Mon(21), May, 2023 12.55pm",
};

const progressSteps = [
	{ label: "Thermal Image Upload", status: "Pending" },
	{ label: "AI Analysis", status: "Pending" },
	{ label: "Thermal Image Review", status: "Pending" },
];

const weatherOptions = ["Sunny", "Cloudy", "Rainy", "Windy"];

export default function ImageUploadPage() {
	const [weather, setWeather] = useState(weatherOptions[0]);
	const [image, setImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setImage(file);
		if (file) {
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		} else {
			setImagePreview(null);
		}
	};

	return (
		<div className="min-h-screen bg-[#f8f9fb] p-8">
			{/* Inspection Details Header */}
			<div className="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between mb-8">
				<div className="flex flex-col gap-2">
					<div className="text-lg font-semibold">{inspectionDetails.inspectionId}</div>
					<div className="text-sm text-gray-500">{inspectionDetails.inspectionDate}</div>
					<div className="flex gap-2 mt-2 flex-wrap">
						<span className="bg-[#f3f4f6] px-3 py-1 rounded text-sm font-medium">{inspectionDetails.transformerNo} <span className="text-gray-400">Transformer No</span></span>
						<span className="bg-[#f3f4f6] px-3 py-1 rounded text-sm font-medium">{inspectionDetails.poleNo} <span className="text-gray-400">Pole No</span></span>
						<span className="bg-[#f3f4f6] px-3 py-1 rounded text-sm font-medium">{inspectionDetails.branch} <span className="text-gray-400">Branch</span></span>
						<span className="bg-[#f3f4f6] px-3 py-1 rounded text-sm font-medium">{inspectionDetails.inspectedBy} <span className="text-gray-400">Inspected By</span></span>
					</div>
				</div>
				<div className="flex flex-col items-end gap-2 mt-4 md:mt-0">
					<div className="text-xs text-gray-400">Last updated: {inspectionDetails.lastUpdated}</div>
					<span className="inline-flex items-center px-3 py-1 rounded bg-green-100 text-green-700 text-sm font-semibold">
						<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
						{inspectionDetails.status}
					</span>
				</div>
			</div>

			<div className="flex flex-col md:flex-row gap-8">
				{/* Left: Upload Card */}
				<div className="bg-white rounded-xl shadow p-6 w-full md:w-96">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold">Thermal Image</h2>
						<span className="px-3 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-medium">Pending</span>
					</div>
					<p className="text-sm text-gray-500 mb-4">Upload a thermal image of the transformer to identify potential issues.</p>
					<div className="mb-4">
						<label className="block text-sm font-medium mb-1">Weather Condition</label>
						<select
							className="w-full border rounded px-3 py-2 focus:outline-none"
							value={weather}
							onChange={e => setWeather(e.target.value)}
						>
							{weatherOptions.map(opt => (
								<option key={opt} value={opt}>{opt}</option>
							))}
						</select>
					</div>
					<div className="mb-4">
						<input
							type="file"
							accept="image/*"
							id="thermal-image-upload"
							className="hidden"
							onChange={handleImageChange}
						/>
						<label htmlFor="thermal-image-upload" className="block w-full">
							<button
								type="button"
								className="w-full bg-[#2d218c] text-white rounded-lg py-3 font-semibold hover:bg-[#1a1466] transition"
							>
								Upload thermal Image
							</button>
						</label>
						{imagePreview && (
							<div className="mt-4">
								<img src={imagePreview} alt="Preview" className="w-full rounded-lg border" />
							</div>
						)}
					</div>
				</div>

				{/* Right: Progress Section */}
				<div className="flex-1">
					<h3 className="text-base font-semibold mb-4">Progress</h3>
					<div className="space-y-4">
						{progressSteps.map((step, idx) => (
							<div key={step.label} className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>
									<span className="font-medium text-gray-700">{step.label}</span>
								</div>
								<span className="text-xs text-yellow-600 font-semibold">{step.status}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
