package com.apexgrid.transformertracker.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(unique = true, nullable = false)
    private String username;

    // Map to existing column name in Postgres (no underscore)
    @Column(name = "passwordhash", nullable = false)
    private String passwordHash;

    // Map to existing column name in Postgres (no underscore)
    @Column(name = "createdat", nullable = false)
    private Instant createdAt = Instant.now();

    // Store base64 data URLs as text instead of LOB to prevent streaming issues in Postgres
    @Column(name = "image", columnDefinition = "text")
    private String image;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }
}
