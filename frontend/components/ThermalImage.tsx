'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface ProgressStepProps {
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
}

interface ThermalImageProps {
  onImageUpload?: (file: File) => void;
  onWeatherChange?: (weather: string) => void;
  onAnalyze?: (weather: string) => void;
  onResetAnalysis?: () => void;
  // New props to trigger backend analysis and bubble result up
  inspectionId: string;
  // Default weather selection provided by parent (e.g., lastAnalysisWeather)
  defaultWeather?: string;
  onPreviewUrl?: (url: string | null) => void;
  onAnalysisResult?: (result: {
    prob: number;
    boxes: number[][] | number[];
    histDistance?: number;
    dv95?: number;
    warmFraction?: number;
    boxInfo?: Array<{ x: number; y: number; w: number; h: number; label?: string; areaFrac?: number; aspect?: number; overlapCenterFrac?: number; boxFault?: string; severity?: number; severityLabel?: string; avgDeltaV?: number; maxDeltaV?: number }>;
    imageWidth?: number;
    imageHeight?: number;
    overallSeverity?: number;
    overallSeverityLabel?: string;
  }) => void;
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
  <div className="flex items-center space-x-3 p-3 border rounded-lg transition-colors">
      <div
        className={`w-4 h-4 rounded-full ${getStatusColor(status)}`}
        title={getStatusText(status)}
      ></div>
  <span className="font-medium">{title}</span>
  <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
        {getStatusText(status)}
      </span>
    </div>
  );
};

const ThermalImage: React.FC<ThermalImageProps> = ({
  onImageUpload,
  onWeatherChange,
  onAnalyze,
  onResetAnalysis,
  inspectionId,
  defaultWeather,
  onPreviewUrl,
  onAnalysisResult,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [weather, setWeather] = useState<string>(defaultWeather || 'sunny');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Progress states
  const [uploadStatus, setUploadStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [analysisStatus, setAnalysisStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onPreviewUrl?.(url);

  onImageUpload?.(file);
    }
  };

  const handleWeatherChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newWeather = event.target.value;
    setWeather(newWeather);
    onWeatherChange?.(newWeather);
  };

  // Keep local weather in sync when parent default changes
  useEffect(() => {
    if (defaultWeather && defaultWeather !== weather) {
      setWeather(defaultWeather);
    }
    if (!defaultWeather && weather !== 'sunny') {
      // If default not provided, ensure a sane default
      setWeather('sunny');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultWeather]);

  const resetProgress = () => {
    setUploadStatus('pending');
    setAnalysisStatus('pending');
    setReviewStatus('pending');
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  onPreviewUrl?.(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
    uploadTimerRef.current = null;
    analysisTimerRef.current = null;
    reviewTimerRef.current = null;
    // notify parent to clear overlays/analysis
    onResetAnalysis?.();
  };

  // Start the simulated analysis flow only when Analyze is clicked
  const runAnalysis = () => {
    // Reset progress before re-running
    setUploadStatus('pending');
    setAnalysisStatus('pending');
    setReviewStatus('pending');

    setUploadStatus('in-progress');
    uploadTimerRef.current = setTimeout(() => {
      setUploadStatus('completed');
      setAnalysisStatus('in-progress');

      // Kick off real backend analysis
      void analyzeWithBackend();
    }, 1500);
  };

  const analyzeWithBackend = async () => {
    if (!selectedFile) return;
    try {
      setIsAnalyzing(true);
      // We use the Next public env base to call Spring backend
      const { apiUrl } = await import("@/lib/api");
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('weather', weather);
      const res = await fetch(apiUrl(`/api/inspections/${inspectionId}/analyze`), {
        method: 'POST',
        body: form
      });
      const ok = res.ok;
      const data = ok ? await res.json() : null;
      setAnalysisStatus('completed');
      setReviewStatus('in-progress');
      if (!ok) {
        // finish review quickly on failure
        reviewTimerRef.current = setTimeout(() => setReviewStatus('completed'), 500);
        return;
      }
      // bubble up
      onAnalysisResult?.({
        prob: Number(data.prob ?? 0),
        boxes: data.boxes ?? [],
        histDistance: data.histDistance,
        dv95: data.dv95,
        warmFraction: data.warmFraction,
        boxInfo: data.boxInfo,
        imageWidth: data.imageWidth,
        imageHeight: data.imageHeight,
        overallSeverity: data.overallSeverity,
        overallSeverityLabel: data.overallSeverityLabel,
      });
      reviewTimerRef.current = setTimeout(() => setReviewStatus('completed'), 1000);
  } catch {
      setAnalysisStatus('completed');
      reviewTimerRef.current = setTimeout(() => setReviewStatus('completed'), 500);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Cleanup timers and object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
    };
  }, [previewUrl]);

  return (
  <div className="max-w-2xl mx-auto p-6 rounded-lg shadow-lg transition-colors border dark:border-gray-700 ">
      {/* Title */}
  <h2 className="text-2xl font-bold mb-6">Thermal Image</h2>
      
      {/* Upload Section */}
      <div className="mb-6">
  <label className="block text-sm font-medium mb-2">
          Upload Thermal Image
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            ref={inputRef}
            className={`block w-full text-sm
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              hover:file:bg-blue-100
              customfile
              cursor-pointer`}
          />
          <button
            onClick={() => {
              onAnalyze?.(weather);
              runAnalysis();
            }}
            className="px-4 py-2 text-sm rounded transition-colors custombutton"
            disabled={!selectedFile || isAnalyzing}
            title="Run analysis"
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </button>
          {selectedFile && (
            <button
              onClick={resetProgress}
              className="px-4 py-2 text-sm rounded custombutton"
            >
              Reset
            </button>
          )}
        </div>
        
        {/* Image Preview */}
        {previewUrl && (
          <div className="mt-4 relative w-full h-48 border filepreview rounded-lg border-gray-200">
            <Image
              src={previewUrl}
              alt="Thermal image preview"
              fill
              className="object-contain p-1"
            />
          </div>
        )}
      </div>

      {/* Weather Condition Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Weather Condition
        </label>
        <select
          value={weather}
          onChange={handleWeatherChange}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
            focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600"
        >
          <option value="sunny">Sunny</option>
          <option value="cloudy">Cloudy</option>
          <option value="rainy">Rainy</option>
        </select>
      </div>

      {/* Progress Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Progress</h3>
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