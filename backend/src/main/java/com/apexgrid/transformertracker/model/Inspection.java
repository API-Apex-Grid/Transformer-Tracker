package com.apexgrid.transformertracker.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "inspections")
public class Inspection {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "transformer_id")
    private Transformer transformer;

    @Column(unique = true, nullable = false)
    private String inspectionNumber;

    private String inspectedDate;
    private String maintainanceDate;
    private String branch;
    private String status;

    // Store full data URL (base64) as plain text to avoid LOB stream issues
    @Column(columnDefinition = "text")
    private String imageUrl;
    private String weather;

    // Stores the last weather condition used when analysis was executed
    private String lastAnalysisWeather;

    private String uploadedBy;
    private String imageUploadedBy;
    private Instant imageUploadedAt;

    private boolean favourite = false;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Transformer getTransformer() { return transformer; }
    public void setTransformer(Transformer transformer) { this.transformer = transformer; }

    public String getInspectionNumber() { return inspectionNumber; }
    public void setInspectionNumber(String inspectionNumber) { this.inspectionNumber = inspectionNumber; }

    public String getInspectedDate() { return inspectedDate; }
    public void setInspectedDate(String inspectedDate) { this.inspectedDate = inspectedDate; }

    public String getMaintainanceDate() { return maintainanceDate; }
    public void setMaintainanceDate(String maintainanceDate) { this.maintainanceDate = maintainanceDate; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getWeather() { return weather; }
    public void setWeather(String weather) { this.weather = weather; }

    public String getLastAnalysisWeather() { return lastAnalysisWeather; }
    public void setLastAnalysisWeather(String lastAnalysisWeather) { this.lastAnalysisWeather = lastAnalysisWeather; }

    public String getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; }

    public String getImageUploadedBy() { return imageUploadedBy; }
    public void setImageUploadedBy(String imageUploadedBy) { this.imageUploadedBy = imageUploadedBy; }

    public Instant getImageUploadedAt() { return imageUploadedAt; }
    public void setImageUploadedAt(Instant imageUploadedAt) { this.imageUploadedAt = imageUploadedAt; }

    public boolean isFavourite() { return favourite; }
    public void setFavourite(boolean favourite) { this.favourite = favourite; }
}
