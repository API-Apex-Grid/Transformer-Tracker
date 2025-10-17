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

    // History of analyses: arrays of snapshots aligned by index.
    // Each entry in boundingBoxHistory is a JSON array of boxes (same shape as boundingBoxes)
    @Column(name = "boundingboxhistory", columnDefinition = "text")
    private String boundingBoxHistory;

    // Each entry in faultTypeHistory is a JSON array of strings (same order as its corresponding bounding boxes)
    @Column(name = "faulttypehistory", columnDefinition = "text")
    private String faultTypeHistory;

    // Each entry in annotatedByHistory is a string: "AI" or the username who edited boxes
    // Shape: outer array of snapshots, each inner array aligns 1:1 with faultTypes/boundingBoxes
    @Column(name = "annotatedbyhistory", columnDefinition = "text")
    private String annotatedByHistory;

    // Current per-box annotation source aligned with faultTypes/boundingBoxes (e.g., ["AI", "john", ...])
    @Column(name = "annotatedby", columnDefinition = "text")
    private String annotatedBy;

    // Per-box severity scores aligned with boundingBoxes order. JSON array of numbers (e.g., [0.75, 0.32, null, ...])
    // Only faults annotated by AI have severity values; user-added faults have null severity
    @Column(name = "severity", columnDefinition = "text")
    private String severity;

    // Optional per-box comments entered by users
    @Column(name = "comment", columnDefinition = "text")
    private String comment;

    // Per-box recent status (e.g., added/edited) aligned with boundingBoxes order
    @Column(name = "recentstatus", columnDefinition = "text")
    private String recentStatus;

    // History of per-box severity arrays aligned with boundingBoxHistory/faultTypeHistory snapshots
    @Column(name = "severityhistory", columnDefinition = "text")
    private String severityHistory;

    // History of per-box comments aligned with boundingBoxHistory snapshots
    @Column(name = "commenthistory", columnDefinition = "text")
    private String commentHistory;

    // History of timestamps (ISO-8601 strings) when each snapshot was archived
    @Column(name = "timestamphistory", columnDefinition = "text")
    private String timestampHistory;

    // History of per-box recent statuses aligned with boundingBoxHistory snapshots
    @Column(name = "recentstatushistory", columnDefinition = "text")
    private String recentStatusHistory;


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

    public String getBoundingBoxHistory() { return boundingBoxHistory; }
    public void setBoundingBoxHistory(String boundingBoxHistory) { this.boundingBoxHistory = boundingBoxHistory; }

    public String getFaultTypeHistory() { return faultTypeHistory; }
    public void setFaultTypeHistory(String faultTypeHistory) { this.faultTypeHistory = faultTypeHistory; }

    public String getAnnotatedByHistory() { return annotatedByHistory; }
    public void setAnnotatedByHistory(String annotatedByHistory) { this.annotatedByHistory = annotatedByHistory; }

    public String getAnnotatedBy() { return annotatedBy; }
    public void setAnnotatedBy(String annotatedBy) { this.annotatedBy = annotatedBy; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public String getRecentStatus() { return recentStatus; }
    public void setRecentStatus(String recentStatus) { this.recentStatus = recentStatus; }

    public String getSeverityHistory() { return severityHistory; }
    public void setSeverityHistory(String severityHistory) { this.severityHistory = severityHistory; }

    public String getCommentHistory() { return commentHistory; }
    public void setCommentHistory(String commentHistory) { this.commentHistory = commentHistory; }

    public String getTimestampHistory() { return timestampHistory; }
    public void setTimestampHistory(String timestampHistory) { this.timestampHistory = timestampHistory; }

    public String getRecentStatusHistory() { return recentStatusHistory; }
    public void setRecentStatusHistory(String recentStatusHistory) { this.recentStatusHistory = recentStatusHistory; }
}
