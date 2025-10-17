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
    // Per-box who annotated (JSON string or parsed array), aligned to boundingBoxes order
    // Values typically "AI" or username; defaults to "user" when absent
    annotatedBy?: string | string[] | null;
    // Per-box severity scores (JSON string or parsed array), aligned to boundingBoxes order
    // Only AI-annotated faults have severity; user-added faults have null severity
    severity?: string | (number | null)[] | null;
    // Optional per-box comments, aligned to boundingBoxes order
    comment?: string | (string | null)[] | null;
    favourite?: boolean;
    // History snapshots stored as JSON strings or parsed arrays
    boundingBoxHistory?: string | (number[][] | null)[] | null;
    faultTypeHistory?: string | (string[] | null)[] | null;
    annotatedByHistory?: string | (string[] | null)[] | null;
    severityHistory?: string | ((number | null)[] | null)[] | null;
    commentHistory?: string | ((string | null)[] | null)[] | null;
    timestampHistory?: string | (string | null)[] | null;
    recentStatus?: string | (string | null)[] | null;
    recentStatusHistory?: string | ((string | null)[] | null)[] | null;
}
