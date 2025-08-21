'use client';

import React, { useState } from 'react';

interface ProgressStepProps {
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
}

interface ThermalImageProps {
  onImageUpload?: (file: File) => void;
  onWeatherChange?: (weather: string) => void;
}

const ProgressStep: React.FC<ProgressStepProps> = ({ title, status }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'in-progress':
        return 'bg-green-500';
      case 'completed':
        return 'bg-purple-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 border rounded-lg">
      <div
        className={`w-4 h-4 rounded-full ${getStatusColor(status)}`}
        title={getStatusText(status)}
      ></div>
      <span className="text-gray-700 font-medium">{title}</span>
      <span className="text-sm text-gray-500 ml-auto">
        {getStatusText(status)}
      </span>
    </div>
  );
};

const ThermalImage: React.FC<ThermalImageProps> = ({
  onImageUpload,
  onWeatherChange,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [weather, setWeather] = useState<string>('sunny');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Progress states
  const [uploadStatus, setUploadStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [analysisStatus, setAnalysisStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('in-progress');
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Simulate upload completion
      setTimeout(() => {
        setUploadStatus('completed');
        setAnalysisStatus('in-progress');
        
        // Simulate analysis completion
        setTimeout(() => {
          setAnalysisStatus('completed');
          setReviewStatus('in-progress');
          
          // Simulate review completion
          setTimeout(() => {
            setReviewStatus('completed');
          }, 2000);
        }, 3000);
      }, 1500);
      
      onImageUpload?.(file);
    }
  };

  const handleWeatherChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newWeather = event.target.value;
    setWeather(newWeather);
    onWeatherChange?.(newWeather);
  };

  const resetProgress = () => {
    setUploadStatus('pending');
    setAnalysisStatus('pending');
    setReviewStatus('pending');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Thermal Image</h2>
      
      {/* Upload Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Thermal Image
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />
          {selectedFile && (
            <button
              onClick={resetProgress}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Reset
            </button>
          )}
        </div>
        
        {/* Image Preview */}
        {previewUrl && (
          <div className="mt-4">
            <img
              src={previewUrl}
              alt="Thermal image preview"
              className="max-w-full h-48 object-contain border rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Weather Condition Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Weather Condition
        </label>
        <select
          value={weather}
          onChange={handleWeatherChange}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
            focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="sunny">Sunny</option>
          <option value="cloudy">Cloudy</option>
          <option value="rainy">Rainy</option>
        </select>
      </div>

      {/* Progress Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Progress</h3>
        <div className="space-y-3">
          <ProgressStep title="Thermal image upload" status={uploadStatus} />
          <ProgressStep title="AI analysis" status={analysisStatus} />
          <ProgressStep title="Thermal Image review" status={reviewStatus} />
        </div>
      </div>
    </div>
  );
};

export default ThermalImage;