package com.apexgrid.transformertracker.web;

import com.apexgrid.transformertracker.model.Transformer;
import com.apexgrid.transformertracker.repo.TransformerRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transformers")
public class TransformerController {
    private final TransformerRepo repo;

    public TransformerController(TransformerRepo repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<Transformer> list(@RequestParam(required = false) String tf,
                                  @RequestParam(required = false) Boolean fav) {
        if (tf != null && !tf.isBlank()) {
            return repo.findAll().stream().filter(t -> tf.equals(t.getTransformerNumber())).toList();
        }
        if (Boolean.TRUE.equals(fav)) {
            return repo.findByFavouriteTrue();
        }
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Transformer> getOne(@PathVariable String id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Transformer create(@RequestBody Transformer t) {
        return repo.save(t);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Transformer> update(@PathVariable String id, @RequestBody Transformer t) {
        return repo.findById(id).map(existing -> {
            t.setId(existing.getId());
            return ResponseEntity.ok(repo.save(t));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/{id}/baseline")
    public ResponseEntity<?> uploadBaseline(@PathVariable String id,
                                            @RequestParam("file") MultipartFile file,
                                            @RequestParam("weather") String weather,
                                            @AuthenticationPrincipal UserDetails principal,
                                            @RequestHeader(value = "x-username", required = false) String uploaderHeader) throws Exception {
        return repo.findById(id).map(t -> {
            try {
                String uploader = principal != null ? principal.getUsername() : uploaderHeader;
                String base64 = Base64.getEncoder().encodeToString(file.getBytes());
                String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
                String imageUrl = "data:" + mime + ";base64," + base64;
                Instant now = Instant.now();
                switch (weather) {
                    case "sunny" -> { t.setSunnyImage(imageUrl); t.setSunnyImageUploadedBy(uploader); t.setSunnyImageUploadedAt(now); }
                    case "cloudy" -> { t.setCloudyImage(imageUrl); t.setCloudyImageUploadedBy(uploader); t.setCloudyImageUploadedAt(now); }
                    case "rainy" -> { t.setWindyImage(imageUrl); t.setWindyImageUploadedBy(uploader); t.setWindyImageUploadedAt(now); }
                    default -> { }
                }
                return ResponseEntity.ok(repo.save(t));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }
}
