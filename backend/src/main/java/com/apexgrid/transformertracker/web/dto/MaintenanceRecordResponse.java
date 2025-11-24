package com.apexgrid.transformertracker.web.dto;

import com.apexgrid.transformertracker.model.MaintenanceRecord;

import java.math.BigDecimal;

public record MaintenanceRecordResponse(
        String id,
        String inspectionId,
        String inspectionDate,
        String transformerName,
        String timestamp,
        String inspectorName,
        String status,
        BigDecimal voltage,
        BigDecimal current,
        BigDecimal efficiency,
        String recommendation,
        String remarks
) {
    public static MaintenanceRecordResponse fromEntity(MaintenanceRecord record) {
        if (record == null) {
            return null;
        }
        return new MaintenanceRecordResponse(
                record.getId(),
                record.getInspection() != null ? record.getInspection().getId() : null,
                record.getInspectionDate(),
                record.getTransformerName(),
                record.getTimestamp(),
                record.getInspectorName(),
                record.getStatus(),
                record.getVoltage(),
                record.getCurrent(),
                record.getEfficiency(),
                record.getRecommendation(),
                record.getRemarks()
        );
    }
}
