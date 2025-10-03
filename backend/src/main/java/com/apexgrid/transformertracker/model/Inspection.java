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

    @Column(name = "inspectionnumber", unique = true, nullable = false)
    private String inspectionNumber;

    @Column(name = "inspecteddate")
    private String inspectedDate;
    @Column(name = "maintainancedate")
    private String maintainanceDate;
    private String branch;
    private String status;

    // Store full data URL (base64) as plain text to avoid LOB stream issues
    @Column(name = "imageurl", columnDefinition = "text")
    private String imageUrl;
    private String weather;

    // Stores the last weather condition used when analysis was executed
    @Column(name = "lastanalysisweather")
    private String lastAnalysisWeather;

    @Column(name = "uploadedby")
    private String uploadedBy;
    @Column(name = "imageuploadedby")
    private String imageUploadedBy;
    @Column(name = "imageuploadedat")
    private Instant imageUploadedAt;
    @Column(name = "favourite")
    private boolean favourite = false;

    // Persist detected bounding boxes from analysis as JSON (array of [x,y,w,h])
    // Store as text in DB to avoid dialect-specific JSON types
    @Column(name = "boundingboxes", columnDefinition = "text")
    private String boundingBoxes;


    // Persist per-box fault types corresponding to boundingBoxes order as JSON array of strings
    @Column(name = "faulttypes", columnDefinition = "text")
    private String faultTypes;


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

    public String getBoundingBoxes() { return boundingBoxes; }
    public void setBoundingBoxes(String boundingBoxes) { this.boundingBoxes = boundingBoxes; }

    // overall faultType column removed; only per-box faultTypes are stored

    public String getFaultTypes() { return faultTypes; }
    public void setFaultTypes(String faultTypes) { this.faultTypes = faultTypes; }

    // analyzed image dimensions removed; overlay will infer from image at runtime
}
