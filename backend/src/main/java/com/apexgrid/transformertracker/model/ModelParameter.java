package com.apexgrid.transformertracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ai_model_parameters")
public class ModelParameter {
    @Id
    @Column(name = "param_key", nullable = false, length = 96)
    private String key;

    @Column(name = "param_value", nullable = false)
    private double value;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public ModelParameter() {
    }

    public ModelParameter(String key, double value) {
        this.key = key;
        this.value = value;
        this.updatedAt = Instant.now();
    }

    @PrePersist
    @PreUpdate
    public void touchTimestamp() {
        this.updatedAt = Instant.now();
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public double getValue() {
        return value;
    }

    public void setValue(double value) {
        this.value = value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
