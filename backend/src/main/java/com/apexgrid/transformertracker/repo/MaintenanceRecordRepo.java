package com.apexgrid.transformertracker.repo;

import com.apexgrid.transformertracker.model.MaintenanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MaintenanceRecordRepo extends JpaRepository<MaintenanceRecord, String> {
    Optional<MaintenanceRecord> findByInspectionId(String inspectionId);
    boolean existsByInspectionId(String inspectionId);
}
