package com.apexgrid.transformertracker.web;

import com.apexgrid.transformertracker.model.Inspection;
import com.apexgrid.transformertracker.model.Transformer;
import com.apexgrid.transformertracker.repo.InspectionRepo;
import com.apexgrid.transformertracker.repo.TransformerRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {
    private final InspectionRepo repo;
    private final TransformerRepo transformerRepo;

    public InspectionController(InspectionRepo repo, TransformerRepo transformerRepo) {
        this.repo = repo;
        this.transformerRepo = transformerRepo;
    }

    @GetMapping
    public List<Inspection> list(@RequestParam(required = false) Boolean fav) {
        if (Boolean.TRUE.equals(fav)) return repo.findByFavouriteTrue();
        return repo.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Inspection i) {
        // ensure transformer exists
        Transformer t = i.getTransformer();
        if (t == null || (t.getId() == null && (t.getTransformerNumber() == null || t.getTransformerNumber().isBlank()))) {
            return ResponseEntity.badRequest().body(Map.of("error", "transformer is required"));
        }
        Transformer linked = null;
        if (t.getId() != null) linked = transformerRepo.findById(t.getId()).orElse(null);
        if (linked == null && t.getTransformerNumber() != null) linked = transformerRepo.findByTransformerNumber(t.getTransformerNumber()).orElse(null);
        if (linked == null) return ResponseEntity.badRequest().body(Map.of("error", "Transformer not found for the given transformerNumber"));
        i.setTransformer(linked);
        return ResponseEntity.status(201).body(repo.save(i));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Inspection i) {
        return repo.findById(id).map(existing -> {
            i.setId(existing.getId());
            // re-validate transformer
            Transformer t = i.getTransformer();
            if (t != null) {
                Transformer linked = null;
                if (t.getId() != null) linked = transformerRepo.findById(t.getId()).orElse(null);
                if (linked == null && t.getTransformerNumber() != null) linked = transformerRepo.findByTransformerNumber(t.getTransformerNumber()).orElse(null);
                if (linked == null) return ResponseEntity.badRequest().body(Map.of("error", "Transformer not found for the given transformerNumber"));
                i.setTransformer(linked);
            } else {
                i.setTransformer(existing.getTransformer());
            }
            return ResponseEntity.ok(repo.save(i));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/{id}/upload")
    public ResponseEntity<?> upload(@PathVariable String id,
                                    @RequestParam("file") MultipartFile file,
                                    @RequestParam("weather") String weather,
                                    @RequestHeader(value = "x-username", required = false) String uploader) {
        return repo.findById(id).map(i -> {
            try {
                String base64 = Base64.getEncoder().encodeToString(file.getBytes());
                String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
                String imageUrl = "data:" + mime + ";base64," + base64;
                i.setImageUrl(imageUrl);
                i.setWeather(weather);
                i.setImageUploadedBy(uploader);
                i.setImageUploadedAt(Instant.now());
                return ResponseEntity.ok(repo.save(i));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }
}
