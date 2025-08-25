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
    favourite?: boolean;
}
