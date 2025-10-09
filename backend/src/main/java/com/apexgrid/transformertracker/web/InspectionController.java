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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;

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

    @GetMapping("/{id}")
    public ResponseEntity<Inspection> getOne(@PathVariable String id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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
                // Before performing a new AI analysis, archive any existing analysis to history with annotatedBy = "AI"
                try {
                    archivePreviousAnalysis(i, "AI");
                } catch (Exception ignore) { }
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
                byte[] candidateBytes = file.getBytes();
                BufferedImage candidate = ImageIO.read(new ByteArrayInputStream(candidateBytes));
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
    // Also persist the analyzed image as the current imageUrl so it becomes the default next time
    try {
        String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        String base64 = Base64.getEncoder().encodeToString(candidateBytes);
        String imageUrl = "data:" + mime + ";base64," + base64;
        i.setImageUrl(imageUrl);
    } catch (Exception ignore) { }
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
                StringBuilder ann = new StringBuilder();
                ann.append('[');
                boolean firstAnn = true;
                for (var bi : boxInfoNode) {
                    String label = bi.path("boxFault").asText("none");
                    if (!first) sb.append(',');
                    first = false;
                    // JSON-escape minimal (labels are simple)
                    sb.append('"').append(label.replace("\"", "\\\"")).append('"');
                    // Per-box annotatedBy: analysis-generated boxes are attributed to AI
                    String who = "AI";
                    if (!firstAnn) ann.append(',');
                    firstAnn = false;
                    ann.append('"').append(who).append('"');
                }
                sb.append(']');
                i.setFaultTypes(sb.toString());
                ann.append(']');
                i.setAnnotatedBy(ann.toString());
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

    /**
     * Append the current analysis (boundingBoxes + faultTypes) to history arrays,
     * and add an aligned annotatedByHistory entry.
     */
    private void archivePreviousAnalysis(Inspection i, String annotatedBy) throws Exception {
        String boxesJson = i.getBoundingBoxes();
        String faultsJson = i.getFaultTypes();
        if ((boxesJson == null || boxesJson.isBlank()) && (faultsJson == null || faultsJson.isBlank())) {
            return; // nothing to archive
        }
        ObjectMapper mapper = new ObjectMapper();

        // boundingBoxHistory as array of snapshots
        ArrayNode boxHist;
        String boxHistJson = i.getBoundingBoxHistory();
        if (boxHistJson != null && !boxHistJson.isBlank()) {
            try {
                var node = mapper.readTree(boxHistJson);
                boxHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                boxHist = mapper.createArrayNode();
            }
        } else {
            boxHist = mapper.createArrayNode();
        }
        // push a snapshot (or null placeholder if empty)
        if (boxesJson != null && !boxesJson.isBlank()) {
            try {
                boxHist.add(mapper.readTree(boxesJson));
            } catch (Exception ex) {
                boxHist.addNull();
            }
        } else {
            boxHist.addNull();
        }

        // faultTypeHistory as array of snapshots
        ArrayNode faultHist;
        String faultHistJson = i.getFaultTypeHistory();
        if (faultHistJson != null && !faultHistJson.isBlank()) {
            try {
                var node = mapper.readTree(faultHistJson);
                faultHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                faultHist = mapper.createArrayNode();
            }
        } else {
            faultHist = mapper.createArrayNode();
        }
        if (faultsJson != null && !faultsJson.isBlank()) {
            try {
                faultHist.add(mapper.readTree(faultsJson));
            } catch (Exception ex) {
                faultHist.addNull();
            }
        } else {
            faultHist.addNull();
        }

        // annotatedByHistory as array of snapshots (each snapshot is an array aligned with boxes/faults)
        ArrayNode annotatedHist;
        String annotatedHistJson = i.getAnnotatedByHistory();
        if (annotatedHistJson != null && !annotatedHistJson.isBlank()) {
            try {
                var node = mapper.readTree(annotatedHistJson);
                annotatedHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                annotatedHist = mapper.createArrayNode();
            }
        } else {
            annotatedHist = mapper.createArrayNode();
        }
        // Prefer current per-box annotatedBy array if present; otherwise, fallback to filling with provided actor
        String currentAnn = i.getAnnotatedBy();
        if (currentAnn != null && !currentAnn.isBlank()) {
            try {
                JsonNode annNode = mapper.readTree(currentAnn);
                if (annNode instanceof ArrayNode) {
                    // Store a snapshot of the existing per-box attribution
                    annotatedHist.add(annNode);
                } else {
                    // Fallback: build by repeating actor to match faultTypes length
                    ArrayNode snap = mapper.createArrayNode();
                    JsonNode ftNode = (faultsJson != null && !faultsJson.isBlank()) ? mapper.readTree(faultsJson) : null;
                    int n = (ftNode instanceof ArrayNode) ? ftNode.size() : 0;
                    for (int k = 0; k < n; k++) snap.add(annotatedBy == null || annotatedBy.isBlank() ? "AI" : annotatedBy);
                    if (n == 0) snap.add(annotatedBy == null || annotatedBy.isBlank() ? "AI" : annotatedBy);
                    annotatedHist.add(snap);
                }
            } catch (Exception ex) {
                ArrayNode snap = mapper.createArrayNode();
                JsonNode ftNode;
                try { ftNode = (faultsJson != null && !faultsJson.isBlank()) ? mapper.readTree(faultsJson) : null; } catch (Exception e2) { ftNode = null; }
                int n = (ftNode instanceof ArrayNode) ? ftNode.size() : 0;
                for (int k = 0; k < n; k++) snap.add(annotatedBy == null || annotatedBy.isBlank() ? "AI" : annotatedBy);
                if (n == 0) snap.add(annotatedBy == null || annotatedBy.isBlank() ? "AI" : annotatedBy);
                annotatedHist.add(snap);
            }
        } else {
            // No current annotatedBy array; build snapshot by repeating actor to match faultTypes
            ArrayNode snap = mapper.createArrayNode();
            try {
                JsonNode ftNode = (faultsJson != null && !faultsJson.isBlank()) ? mapper.readTree(faultsJson) : null;
                int n = (ftNode instanceof ArrayNode) ? ftNode.size() : 0;
                for (int k = 0; k < n; k++) snap.add(annotatedBy == null || annotatedBy.isBlank() ? "AI" : annotatedBy);
                if (n == 0) snap.add(annotatedBy == null || annotatedBy.isBlank() ? "AI" : annotatedBy);
            } catch (Exception ex) {
                snap.add(annotatedBy == null || annotatedBy.isBlank() ? "AI" : annotatedBy);
            }
            annotatedHist.add(snap);
        }

        // Persist updated histories ensuring alignment/order
        i.setBoundingBoxHistory(boxHist.toString());
        i.setFaultTypeHistory(faultHist.toString());
        i.setAnnotatedByHistory(annotatedHist.toString());
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

    @DeleteMapping("/{id}/boxes/{index}")
    public ResponseEntity<?> removeBox(@PathVariable String id,
                                       @PathVariable int index,
                                       @RequestHeader(value = "x-username", required = false) String username) {
        return repo.findById(id).map(i -> {
            try {
                // Archive current analysis before modification by user
                try { archivePreviousAnalysis(i, username == null || username.isBlank() ? "user" : username); } catch (Exception ignore) { }
                String boxesJson = i.getBoundingBoxes();
                if (boxesJson == null || boxesJson.isBlank()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "No bounding boxes to modify"));
                }
                ObjectMapper mapper = new ObjectMapper();
                JsonNode node = mapper.readTree(boxesJson);
                if (!(node instanceof ArrayNode)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "boundingBoxes is not an array"));
                }
                ArrayNode arr = (ArrayNode) node;
                if (index < 0 || index >= arr.size()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Index out of range"));
                }
                // Remove the box at index
                arr.remove(index);
                i.setBoundingBoxes(arr.toString());

                // Update faultTypes if present and valid
                String ftJson = i.getFaultTypes();
                if (ftJson != null && !ftJson.isBlank()) {
                    try {
                        JsonNode ftNode = mapper.readTree(ftJson);
                        if (ftNode instanceof ArrayNode) {
                            ArrayNode ftArr = (ArrayNode) ftNode;
                            if (index >= 0 && index < ftArr.size()) {
                                ftArr.remove(index);
                                i.setFaultTypes(ftArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed faultTypes */ }
                }

                // Update annotatedBy array to maintain alignment
                String annJson = i.getAnnotatedBy();
                if (annJson != null && !annJson.isBlank()) {
                    try {
                        JsonNode annNode = mapper.readTree(annJson);
                        if (annNode instanceof ArrayNode) {
                            ArrayNode annArr = (ArrayNode) annNode;
                            if (index >= 0 && index < annArr.size()) {
                                annArr.remove(index);
                                i.setAnnotatedBy(annArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed annotatedBy */ }
                }

                repo.save(i);
                return ResponseEntity.ok(Map.of("ok", true, "boundingBoxes", arr, "faultTypes", i.getFaultTypes()));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Failed to remove box"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/boxes")
    public ResponseEntity<?> removeBoxByValue(@PathVariable String id,
                                              @RequestParam("x") double x,
                                              @RequestParam("y") double y,
                                              @RequestParam("w") double w,
                                              @RequestParam("h") double h,
                                              @RequestHeader(value = "x-username", required = false) String username) {
        return repo.findById(id).map(i -> {
            try {
                // Archive current analysis before modification by user
                try { archivePreviousAnalysis(i, username == null || username.isBlank() ? "user" : username); } catch (Exception ignore) { }
                String boxesJson = i.getBoundingBoxes();
                if (boxesJson == null || boxesJson.isBlank()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "No bounding boxes to modify"));
                }
                ObjectMapper mapper = new ObjectMapper();
                JsonNode node = mapper.readTree(boxesJson);
                if (!(node instanceof ArrayNode)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "boundingBoxes is not an array"));
                }
                ArrayNode arr = (ArrayNode) node;
                int matchIdx = -1;
                final double EPS = 0.5; // tolerance for float vs int serialization
                for (int idx = 0; idx < arr.size(); idx++) {
                    JsonNode b = arr.get(idx);
                    if (b instanceof ArrayNode && b.size() >= 4) {
                        double bx = b.get(0).asDouble();
                        double by = b.get(1).asDouble();
                        double bw = b.get(2).asDouble();
                        double bh = b.get(3).asDouble();
                        if (Math.abs(bx - x) < EPS && Math.abs(by - y) < EPS && Math.abs(bw - w) < EPS && Math.abs(bh - h) < EPS) {
                            matchIdx = idx;
                            break;
                        }
                    }
                }
                if (matchIdx < 0) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Box not found"));
                }
                arr.remove(matchIdx);
                i.setBoundingBoxes(arr.toString());

                String ftJson = i.getFaultTypes();
                if (ftJson != null && !ftJson.isBlank()) {
                    try {
                        JsonNode ftNode = mapper.readTree(ftJson);
                        if (ftNode instanceof ArrayNode) {
                            ArrayNode ftArr = (ArrayNode) ftNode;
                            if (matchIdx >= 0 && matchIdx < ftArr.size()) {
                                ftArr.remove(matchIdx);
                                i.setFaultTypes(ftArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed faultTypes */ }
                }

                // Update annotatedBy alignment
                String annJson = i.getAnnotatedBy();
                if (annJson != null && !annJson.isBlank()) {
                    try {
                        JsonNode annNode = mapper.readTree(annJson);
                        if (annNode instanceof ArrayNode) {
                            ArrayNode annArr = (ArrayNode) annNode;
                            if (matchIdx >= 0 && matchIdx < annArr.size()) {
                                annArr.remove(matchIdx);
                                i.setAnnotatedBy(annArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed annotatedBy */ }
                }

                repo.save(i);
                return ResponseEntity.ok(Map.of("ok", true, "boundingBoxes", arr, "faultTypes", i.getFaultTypes()));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Failed to remove box"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/boxes")
    public ResponseEntity<?> addBox(@PathVariable String id,
                                    @RequestBody Map<String, Object> payload,
                                    @RequestHeader(value = "x-username", required = false) String username) {
        return repo.findById(id).map(i -> {
            try {
                // Archive current analysis before modification by user
                try { archivePreviousAnalysis(i, username == null || username.isBlank() ? "user" : username); } catch (Exception ignore) { }
                double x = ((Number)payload.getOrDefault("x", 0)).doubleValue();
                double y = ((Number)payload.getOrDefault("y", 0)).doubleValue();
                double w = ((Number)payload.getOrDefault("w", 0)).doubleValue();
                double h = ((Number)payload.getOrDefault("h", 0)).doubleValue();
                String faultType = String.valueOf(payload.getOrDefault("faultType", "none"));

                ObjectMapper mapper = new ObjectMapper();
                ArrayNode boxesArr;
                String boxesJson = i.getBoundingBoxes();
                if (boxesJson != null && !boxesJson.isBlank()) {
                    try {
                        var node = mapper.readTree(boxesJson);
                        boxesArr = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
                    } catch (Exception ex) {
                        boxesArr = mapper.createArrayNode();
                    }
                } else {
                    boxesArr = mapper.createArrayNode();
                }
                ArrayNode newBox = mapper.createArrayNode();
                newBox.add(x).add(y).add(w).add(h);
                boxesArr.add(newBox);
                i.setBoundingBoxes(boxesArr.toString());

                // Update faultTypes aligned with boxes
                ArrayNode ftArr;
                String ftJson = i.getFaultTypes();
                if (ftJson != null && !ftJson.isBlank()) {
                    try {
                        var node = mapper.readTree(ftJson);
                        ftArr = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
                    } catch (Exception ex) {
                        ftArr = mapper.createArrayNode();
                    }
                } else {
                    ftArr = mapper.createArrayNode();
                }
                ftArr.add(faultType);
                i.setFaultTypes(ftArr.toString());

                // Update per-box annotatedBy aligned with boxes
                ArrayNode annArr;
                String annJson = i.getAnnotatedBy();
                if (annJson != null && !annJson.isBlank()) {
                    try {
                        var node = mapper.readTree(annJson);
                        annArr = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
                    } catch (Exception ex) {
                        annArr = mapper.createArrayNode();
                    }
                } else {
                    annArr = mapper.createArrayNode();
                }
                String who = username == null || username.isBlank() ? "user" : username;
                annArr.add(who);
                i.setAnnotatedBy(annArr.toString());

                repo.save(i);
                return ResponseEntity.ok(Map.of("ok", true, "boundingBoxes", boxesArr, "faultTypes", ftArr));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Failed to add box"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/boxes/bulk")
    public ResponseEntity<?> bulkUpdateBoxes(@PathVariable String id,
                                             @RequestBody Map<String, Object> payload,
                                             @RequestHeader(value = "x-username", required = false) String username) {
        return repo.findById(id).map(i -> {
            try {
                // Archive previous analysis once before bulk update
                try { archivePreviousAnalysis(i, username == null || username.isBlank() ? "user" : username); } catch (Exception ignore) { }

                ObjectMapper mapper = new ObjectMapper();
                
                // Parse incoming boxes, faultTypes, and annotatedBy from request
                var boxesPayload = payload.get("boundingBoxes");
                var faultsPayload = payload.get("faultTypes");
                var annotatedByPayload = payload.get("annotatedBy");

                ArrayNode finalBoxes = mapper.createArrayNode();
                if (boxesPayload instanceof List) {
                    for (Object boxObj : (List<?>) boxesPayload) {
                        if (boxObj instanceof List) {
                            List<?> boxList = (List<?>) boxObj;
                            if (boxList.size() >= 4) {
                                ArrayNode boxNode = mapper.createArrayNode();
                                boxNode.add(((Number) boxList.get(0)).doubleValue());
                                boxNode.add(((Number) boxList.get(1)).doubleValue());
                                boxNode.add(((Number) boxList.get(2)).doubleValue());
                                boxNode.add(((Number) boxList.get(3)).doubleValue());
                                finalBoxes.add(boxNode);
                            }
                        }
                    }
                }

                ArrayNode finalFaults = mapper.createArrayNode();
                if (faultsPayload instanceof List) {
                    for (Object ft : (List<?>) faultsPayload) {
                        finalFaults.add(ft != null ? ft.toString() : "none");
                    }
                }

                // Use annotatedBy from request if provided; otherwise fill with username
                ArrayNode finalAnnotated = mapper.createArrayNode();
                if (annotatedByPayload instanceof List) {
                    for (Object ann : (List<?>) annotatedByPayload) {
                        finalAnnotated.add(ann != null ? ann.toString() : (username == null || username.isBlank() ? "user" : username));
                    }
                } else {
                    // Fallback: fill with username for all boxes
                    String who = username == null || username.isBlank() ? "user" : username;
                    for (int k = 0; k < finalFaults.size(); k++) {
                        finalAnnotated.add(who);
                    }
                }

                // Persist final state
                i.setBoundingBoxes(finalBoxes.toString());
                i.setFaultTypes(finalFaults.toString());
                i.setAnnotatedBy(finalAnnotated.toString());
                repo.save(i);

                return ResponseEntity.ok(Map.of("ok", true, "boundingBoxes", finalBoxes, "faultTypes", finalFaults));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Bulk update failed"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    // No-op
}
