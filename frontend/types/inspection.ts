export interface Inspection {
    id?: string;
    transformerNumber: string;
    inspectionNumber: string;
    inspectedDate: string;
    maintainanceDate: string;
    branch: string;
    status: string;
    imageUrl?: string | null;
    weather?: "sunny" | "cloudy" | "rainy" | null;
    uploadedBy?: string | null;
    imageUploadedBy?: string | null;
    imageUploadedAt?: string | null;
    lastAnalysisWeather?: "sunny" | "cloudy" | "rainy" | string | null;
    // Serialized JSON string of boxes [[x,y,w,h], ...] or already parsed structure when coming from API
    boundingBoxes?: string | number[][] | number[] | null;
    // overall faultType removed; use per-box faultTypes
    // Per-box fault types (JSON string or parsed array), aligned to boundingBoxes order
    faultTypes?: string | string[] | null;
    favourite?: boolean;
}
