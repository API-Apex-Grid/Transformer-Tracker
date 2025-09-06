package com.apexgrid.transformertracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "transformers")
public class Transformer {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String region;

    @Column(unique = true, nullable = false)
    private String transformerNumber;

    private String poleNumber;
    private String type;
    @Column(length = 2048)
    private String location;

    @Lob
    private String sunnyImage;
    @Lob
    private String cloudyImage;
    @Lob
    private String windyImage;

    private String uploadedBy;
    private String sunnyImageUploadedBy;
    private String cloudyImageUploadedBy;
    private String windyImageUploadedBy;

    private Instant sunnyImageUploadedAt;
    private Instant cloudyImageUploadedAt;
    private Instant windyImageUploadedAt;

    private boolean favourite = false;

    @OneToMany(mappedBy = "transformer", cascade = CascadeType.REMOVE, orphanRemoval = true)
    @JsonIgnore // avoid recursion; the frontend fetches inspections separately
    private List<Inspection> inspections = new ArrayList<>();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getTransformerNumber() { return transformerNumber; }
    public void setTransformerNumber(String transformerNumber) { this.transformerNumber = transformerNumber; }

    public String getPoleNumber() { return poleNumber; }
    public void setPoleNumber(String poleNumber) { this.poleNumber = poleNumber; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getSunnyImage() { return sunnyImage; }
    public void setSunnyImage(String sunnyImage) { this.sunnyImage = sunnyImage; }

    public String getCloudyImage() { return cloudyImage; }
    public void setCloudyImage(String cloudyImage) { this.cloudyImage = cloudyImage; }

    public String getWindyImage() { return windyImage; }
    public void setWindyImage(String windyImage) { this.windyImage = windyImage; }

    public String getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; }

    public String getSunnyImageUploadedBy() { return sunnyImageUploadedBy; }
    public void setSunnyImageUploadedBy(String sunnyImageUploadedBy) { this.sunnyImageUploadedBy = sunnyImageUploadedBy; }

    public String getCloudyImageUploadedBy() { return cloudyImageUploadedBy; }
    public void setCloudyImageUploadedBy(String cloudyImageUploadedBy) { this.cloudyImageUploadedBy = cloudyImageUploadedBy; }

    public String getWindyImageUploadedBy() { return windyImageUploadedBy; }
    public void setWindyImageUploadedBy(String windyImageUploadedBy) { this.windyImageUploadedBy = windyImageUploadedBy; }

    public Instant getSunnyImageUploadedAt() { return sunnyImageUploadedAt; }
    public void setSunnyImageUploadedAt(Instant sunnyImageUploadedAt) { this.sunnyImageUploadedAt = sunnyImageUploadedAt; }

    public Instant getCloudyImageUploadedAt() { return cloudyImageUploadedAt; }
    public void setCloudyImageUploadedAt(Instant cloudyImageUploadedAt) { this.cloudyImageUploadedAt = cloudyImageUploadedAt; }

    public Instant getWindyImageUploadedAt() { return windyImageUploadedAt; }
    public void setWindyImageUploadedAt(Instant windyImageUploadedAt) { this.windyImageUploadedAt = windyImageUploadedAt; }

    public boolean isFavourite() { return favourite; }
    public void setFavourite(boolean favourite) { this.favourite = favourite; }

    public List<Inspection> getInspections() { return inspections; }
    public void setInspections(List<Inspection> inspections) { this.inspections = inspections; }
}
