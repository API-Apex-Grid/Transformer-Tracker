export interface MaintenanceRecord {
  id?: string | null;
  inspectionId?: string | null;
  inspectionDate?: string | null;
  transformerName?: string | null;
  timestamp: string;
  inspectorName?: string | null;
  status?: string | null;
  voltage?: number | null;
  current?: number | null;
  efficiency?: number | null;
  recommendation?: string | null;
  remarks?: string | null;
}
