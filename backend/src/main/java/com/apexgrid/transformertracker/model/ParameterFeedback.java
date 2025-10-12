package com.apexgrid.transformertracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_tuning_feedback")
public class ParameterFeedback {
    @Id
    private UUID id;

    @Column(name = "inspection_id", nullable = false, length = 64)
    private String inspectionId;

    @Column(name = "ai_box_count", nullable = false)
    private int aiBoxCount;

    @Column(name = "user_box_count", nullable = false)
    private int userBoxCount;

    @Column(name = "box_diff", nullable = false)
    private int boxDiff;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "previous_snapshot", columnDefinition = "text")
    private String previousSnapshot;

    @Column(name = "final_snapshot", columnDefinition = "text")
    private String finalSnapshot;

    @Column(name = "previous_faults", columnDefinition = "text")
    private String previousFaults;

    @Column(name = "final_faults", columnDefinition = "text")
    private String finalFaults;

    @Column(name = "previous_annotated", columnDefinition = "text")
    private String previousAnnotated;

    @Column(name = "final_annotated", columnDefinition = "text")
    private String finalAnnotated;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    public ParameterFeedback() {
    }

    public ParameterFeedback(String inspectionId,
                             int aiBoxCount,
                             int userBoxCount,
                             int boxDiff,
                             String previousSnapshot,
                             String finalSnapshot,
                             String previousFaults,
                             String finalFaults,
                             String previousAnnotated,
                             String finalAnnotated,
                             String notes) {
        this.inspectionId = inspectionId;
        this.aiBoxCount = aiBoxCount;
        this.userBoxCount = userBoxCount;
        this.boxDiff = boxDiff;
        this.previousSnapshot = previousSnapshot;
        this.finalSnapshot = finalSnapshot;
        this.previousFaults = previousFaults;
        this.finalFaults = finalFaults;
        this.previousAnnotated = previousAnnotated;
        this.finalAnnotated = finalAnnotated;
        this.notes = notes;
        this.createdAt = Instant.now();
    }

    @PrePersist
    public void ensureIds() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(String inspectionId) {
        this.inspectionId = inspectionId;
    }

    public int getAiBoxCount() {
        return aiBoxCount;
    }

    public void setAiBoxCount(int aiBoxCount) {
        this.aiBoxCount = aiBoxCount;
    }

    public int getUserBoxCount() {
        return userBoxCount;
    }

    public void setUserBoxCount(int userBoxCount) {
        this.userBoxCount = userBoxCount;
    }

    public int getBoxDiff() {
        return boxDiff;
    }

    public void setBoxDiff(int boxDiff) {
        this.boxDiff = boxDiff;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getPreviousSnapshot() {
        return previousSnapshot;
    }

    public void setPreviousSnapshot(String previousSnapshot) {
        this.previousSnapshot = previousSnapshot;
    }

    public String getFinalSnapshot() {
        return finalSnapshot;
    }

    public void setFinalSnapshot(String finalSnapshot) {
        this.finalSnapshot = finalSnapshot;
    }

    public String getPreviousFaults() {
        return previousFaults;
    }

    public void setPreviousFaults(String previousFaults) {
        this.previousFaults = previousFaults;
    }

    public String getFinalFaults() {
        return finalFaults;
    }

    public void setFinalFaults(String finalFaults) {
        this.finalFaults = finalFaults;
    }

    public String getPreviousAnnotated() {
        return previousAnnotated;
    }

    public void setPreviousAnnotated(String previousAnnotated) {
        this.previousAnnotated = previousAnnotated;
    }

    public String getFinalAnnotated() {
        return finalAnnotated;
    }

    public void setFinalAnnotated(String finalAnnotated) {
        this.finalAnnotated = finalAnnotated;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
