package com.apexgrid.transformertracker.web;

import com.apexgrid.transformertracker.model.Inspection;
import com.apexgrid.transformertracker.model.Transformer;
import com.apexgrid.transformertracker.repo.InspectionRepo;
import com.apexgrid.transformertracker.repo.TransformerRepo;
import com.apexgrid.transformertracker.ai.PythonAnalyzerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Base64;
import java.util.Map;
import javax.imageio.ImageIO;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {
    private final InspectionRepo repo;
    private final TransformerRepo transformerRepo;
    private final PythonAnalyzerService pythonAnalyzerService;

    public InspectionController(InspectionRepo repo, TransformerRepo transformerRepo, PythonAnalyzerService pythonAnalyzerService) {
        this.repo = repo;
        this.transformerRepo = transformerRepo;
        this.pythonAnalyzerService = pythonAnalyzerService;
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

    @PostMapping("/{id}/analyze")
    public ResponseEntity<?> analyze(@PathVariable String id,
                                     @RequestParam("file") MultipartFile file,
                                     @RequestParam("weather") String weather) {
        return repo.findById(id).map(i -> {
            try {
                // Find baseline image from transformer based on weather
                Transformer t = i.getTransformer();
                if (t == null) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Inspection not linked to a transformer"));
                }
                String baselineDataUrl = switch (weather == null ? "" : weather) {
                    case "sunny" -> t.getSunnyImage();
                    case "cloudy" -> t.getCloudyImage();
                    case "rainy" -> t.getWindyImage();
                    default -> {
                        String any = t.getSunnyImage();
                        if (any == null || any.isBlank()) any = t.getCloudyImage();
                        if (any == null || any.isBlank()) any = t.getWindyImage();
                        yield any;
                    }
                };
                if (baselineDataUrl == null || baselineDataUrl.isBlank()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "No baseline image available for selected weather"));
                }

                BufferedImage baseline = readDataUrlToImage(baselineDataUrl);
                BufferedImage candidate = ImageIO.read(new ByteArrayInputStream(file.getBytes()));
                if (baseline == null || candidate == null) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Invalid images for analysis"));
                }

                // Resize baseline to candidate size for comparison
                int W = candidate.getWidth();
                int H = candidate.getHeight();
                BufferedImage baseResized = resize(baseline, W, H);

    var result = pythonAnalyzerService.analyze(baseResized, candidate);

    // Persist last analysis weather and detected bounding boxes on the inspection
    i.setLastAnalysisWeather(weather);
    // Keep the inspection's weather in sync with the last used weather for convenience
    i.setWeather(weather);
        try {
            // Persist only the boxes array as returned by Python
            var boxesNode = result.path("boxes");
            if (boxesNode != null && !boxesNode.isMissingNode()) {
                // Serialize to compact JSON string
                String boxesJson = boxesNode.toString();
                i.setBoundingBoxes(boxesJson);
            }
            // Overall faultType column removed; we persist only per-box faultTypes
            // Persist per-box fault types (map boxInfo[].boxFault when available)
            var boxInfoNode = result.path("boxInfo");
            if (boxInfoNode != null && boxInfoNode.isArray()) {
                // Build array of fault labels aligned with boxes
                // When lengths mismatch, fall back to best-effort order
                StringBuilder sb = new StringBuilder();
                sb.append('[');
                boolean first = true;
                for (var bi : boxInfoNode) {
                    String label = bi.path("boxFault").asText("none");
                    if (!first) sb.append(',');
                    first = false;
                    // JSON-escape minimal (labels are simple)
                    sb.append('"').append(label.replace("\"", "\\\"")).append('"');
                }
                sb.append(']');
                i.setFaultTypes(sb.toString());
            }
            // analyzed image dimensions no longer persisted
        } catch (Exception ignore) { }
        repo.save(i);

        // Pass through fields as-is from Python, including fault classification
    return ResponseEntity.ok(Map.of(
        "prob", result.path("prob").asDouble(0.0),
        "histDistance", result.path("histDistance").asDouble(0.0),
        "dv95", result.path("dv95").asDouble(0.0),
        "warmFraction", result.path("warmFraction").asDouble(0.0),
        // Provide dimensions from the analyzed candidate image
        "imageWidth", result.path("imageWidth").asInt(W),
        "imageHeight", result.path("imageHeight").asInt(H),
        "boxes", result.path("boxes"),
        "boxInfo", result.path("boxInfo"),
    // faultType removed from API; UI derives from per-box faultTypes if needed
        // 'annotated' from Python is ignored by the frontend; retain for debugging
        "annotated", result.path("annotated").asText("")
    ));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Analysis failed"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/clear-analysis")
    public ResponseEntity<?> clearAnalysis(@PathVariable String id) {
        return repo.findById(id).map(i -> {
            // Remove stored analysis artifacts
            i.setImageUrl(null);
            i.setBoundingBoxes(null);
            // Also clear per-box fault types and dimensions if present
            try {
                // These setters exist but may be null in DB schema; safe to call
                i.setFaultTypes(null);
                // Clear the last analysis weather since analysis has been cleared
                i.setLastAnalysisWeather(null);
                // analyzed image dimensions removed; nothing to clear
            } catch (Exception ignore) { }
            repo.save(i);
            return ResponseEntity.ok(Map.of("ok", true));
        }).orElse(ResponseEntity.notFound().build());
    }
    private static BufferedImage resize(BufferedImage src, int W, int H) {
        if (src.getWidth() == W && src.getHeight() == H) return src;
        BufferedImage out = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, 0, 0, W, H, null);
        g.dispose();
        return out;
    }

    private static BufferedImage readDataUrlToImage(String dataUrl) throws Exception {
        // format: data:<mime>;base64,<data>
        int comma = dataUrl.indexOf(',');
        if (comma < 0) return null;
        String base64 = dataUrl.substring(comma + 1);
        byte[] bytes = Base64.getDecoder().decode(base64);
        return ImageIO.read(new ByteArrayInputStream(bytes));
    }
}
