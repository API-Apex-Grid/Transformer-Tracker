package com.apexgrid.transformertracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "maintenance_records")
public class MaintenanceRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "timestamp", nullable = false, columnDefinition = "text")
    private String timestamp;

    @Column(name = "transformername", nullable = false)
    private String transformerName;

    @Column(name = "inspectorname")
    private String inspectorName;

    @Column(name = "status")
    private String status;

    @Column(name = "voltage")
    private BigDecimal voltage;

    @Column(name = "current")
    private BigDecimal current;

    @Column(name = "efficiency")
    private BigDecimal efficiency;

    @Column(name = "reccomendation", columnDefinition = "text")
    private String recommendation;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "inspectiondate")
    private String inspectionDate;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inspectionid", nullable = false)
    @JsonIgnore
    private Inspection inspection;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getTransformerName() {
        return transformerName;
    }

    public void setTransformerName(String transformerName) {
        this.transformerName = transformerName;
    }

    public String getInspectorName() {
        return inspectorName;
    }

    public void setInspectorName(String inspectorName) {
        this.inspectorName = inspectorName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getVoltage() {
        return voltage;
    }

    public void setVoltage(BigDecimal voltage) {
        this.voltage = voltage;
    }

    public BigDecimal getCurrent() {
        return current;
    }

    public void setCurrent(BigDecimal current) {
        this.current = current;
    }

    public BigDecimal getEfficiency() {
        return efficiency;
    }

    public void setEfficiency(BigDecimal efficiency) {
        this.efficiency = efficiency;
    }

    public String getRecommendation() {
        return recommendation;
    }

    public void setRecommendation(String recommendation) {
        this.recommendation = recommendation;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getInspectionDate() {
        return inspectionDate;
    }

    public void setInspectionDate(String inspectionDate) {
        this.inspectionDate = inspectionDate;
    }

    public Inspection getInspection() {
        return inspection;
    }

    public void setInspection(Inspection inspection) {
        this.inspection = inspection;
    }
}
