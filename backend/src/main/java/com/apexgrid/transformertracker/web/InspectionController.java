package com.apexgrid.transformertracker.web;

import com.apexgrid.transformertracker.ai.AiParameterService;
import com.apexgrid.transformertracker.ai.ParameterTuningService;
import com.apexgrid.transformertracker.ai.PythonAnalyzerService;
import com.apexgrid.transformertracker.model.Inspection;
import com.apexgrid.transformertracker.model.Transformer;
import com.apexgrid.transformertracker.repo.InspectionRepo;
import com.apexgrid.transformertracker.repo.TransformerRepo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {
    private final InspectionRepo repo;
    private final TransformerRepo transformerRepo;
    private final PythonAnalyzerService pythonAnalyzerService;
    private final ParameterTuningService parameterTuningService;
    private final AiParameterService aiParameterService;

    public InspectionController(InspectionRepo repo,
                                TransformerRepo transformerRepo,
                                PythonAnalyzerService pythonAnalyzerService,
                                ParameterTuningService parameterTuningService,
                                AiParameterService aiParameterService) {
        this.repo = repo;
        this.transformerRepo = transformerRepo;
        this.pythonAnalyzerService = pythonAnalyzerService;
        this.parameterTuningService = parameterTuningService;
        this.aiParameterService = aiParameterService;
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

    @GetMapping("/{id}/export")
    public ResponseEntity<?> exportInspection(@PathVariable String id) {
        return repo.findById(id).map(inspection -> {
            try {
                ObjectMapper mapper = new ObjectMapper();
                Instant generatedAt = Instant.now();

                ObjectNode root = mapper.createObjectNode();
                root.put("exportGeneratedAt", generatedAt.toString());

                ObjectNode inspectionNode = root.putObject("inspection");
                putNullable(inspectionNode, "id", inspection.getId());
                putNullable(inspectionNode, "inspectionNumber", inspection.getInspectionNumber());
                putNullable(inspectionNode, "branch", inspection.getBranch());
                putNullable(inspectionNode, "status", inspection.getStatus());
                putNullable(inspectionNode, "inspectedDate", inspection.getInspectedDate());
                putNullable(inspectionNode, "maintainanceDate", inspection.getMaintainanceDate());
                putNullable(inspectionNode, "uploadedBy", inspection.getUploadedBy());
                putNullable(inspectionNode, "imageUploadedBy", inspection.getImageUploadedBy());
                putNullable(inspectionNode, "imageUploadedAt",
                        inspection.getImageUploadedAt() != null ? inspection.getImageUploadedAt().toString() : null);
                putNullable(inspectionNode, "weather", inspection.getWeather());
                putNullable(inspectionNode, "lastAnalysisWeather", inspection.getLastAnalysisWeather());
                inspectionNode.put("favourite", inspection.isFavourite());

                Transformer transformer = inspection.getTransformer();
                if (transformer != null) {
                    ObjectNode transformerNode = inspectionNode.putObject("transformer");
                    putNullable(transformerNode, "id", transformer.getId());
                    putNullable(transformerNode, "transformerNumber", transformer.getTransformerNumber());
                    putNullable(transformerNode, "poleNumber", transformer.getPoleNumber());
                    putNullable(transformerNode, "region", transformer.getRegion());
                    putNullable(transformerNode, "type", transformer.getType());
                } else {
                    inspectionNode.putNull("transformer");
                }
                BaselineSelection baselineSelection = resolveBaselineSelection(inspection);
                putNullable(inspectionNode, "baselineWeather",
                        baselineSelection != null ? baselineSelection.weatherLabel() : null);

                JsonNode currentBoxes = parseJsonNode(mapper, inspection.getBoundingBoxes());
                JsonNode currentFaults = parseJsonNode(mapper, inspection.getFaultTypes());
                JsonNode currentAnnotated = parseJsonNode(mapper, inspection.getAnnotatedBy());
                JsonNode currentSeverity = parseJsonNode(mapper, inspection.getSeverity());
                JsonNode currentComments = parseJsonNode(mapper, inspection.getComment());
                JsonNode currentCreatedAt = parseJsonNode(mapper, inspection.getBoxCreatedAt());

                ObjectNode currentNode = root.putObject("current");
                putNullable(currentNode, "timestamp",
                        inspection.getImageUploadedAt() != null ? inspection.getImageUploadedAt().toString() : generatedAt.toString());
                currentNode.set("boundingBoxes", cloneNode(currentBoxes));
                currentNode.set("faultTypes", cloneNode(currentFaults));
                currentNode.set("annotatedBy", cloneNode(currentAnnotated));
                currentNode.set("severity", cloneNode(currentSeverity));
                currentNode.set("comments", cloneNode(currentComments));
                currentNode.set("boxCreatedAt", cloneNode(currentCreatedAt));

                ArrayNode boxHistory = asArrayNode(parseJsonNode(mapper, inspection.getBoundingBoxHistory()));
                ArrayNode faultHistory = asArrayNode(parseJsonNode(mapper, inspection.getFaultTypeHistory()));
                ArrayNode annotatedHistory = asArrayNode(parseJsonNode(mapper, inspection.getAnnotatedByHistory()));
                ArrayNode severityHistory = asArrayNode(parseJsonNode(mapper, inspection.getSeverityHistory()));
                ArrayNode commentHistory = asArrayNode(parseJsonNode(mapper, inspection.getCommentHistory()));
                ArrayNode timestampHistory = asArrayNode(parseJsonNode(mapper, inspection.getTimestampHistory()));
                ArrayNode createdAtHistory = asArrayNode(parseJsonNode(mapper, inspection.getBoxCreatedAtHistory()));

                ArrayNode history = mapper.createArrayNode();
                int snapshotCount = maxSize(boxHistory, faultHistory, annotatedHistory, severityHistory, commentHistory, timestampHistory, createdAtHistory);
                for (int index = 0; index < snapshotCount; index++) {
                    ObjectNode entry = mapper.createObjectNode();
                    String ts = extractText(timestampHistory, index);
                    putNullable(entry, "timestamp", ts);
                    entry.put("isCurrent", false);
                    entry.set("boundingBoxes", cloneNode(snapshotValue(boxHistory, index)));
                    entry.set("faultTypes", cloneNode(snapshotValue(faultHistory, index)));
                    entry.set("annotatedBy", cloneNode(snapshotValue(annotatedHistory, index)));
                    entry.set("severity", cloneNode(snapshotValue(severityHistory, index)));
                    entry.set("comments", cloneNode(snapshotValue(commentHistory, index)));
                    entry.set("boxCreatedAt", cloneNode(snapshotValue(createdAtHistory, index)));
                    history.add(entry);
                }

                ObjectNode currentEntry = mapper.createObjectNode();
                putNullable(currentEntry, "timestamp",
                        inspection.getImageUploadedAt() != null ? inspection.getImageUploadedAt().toString() : generatedAt.toString());
                currentEntry.put("isCurrent", true);
                currentEntry.set("boundingBoxes", cloneNode(currentBoxes));
                currentEntry.set("faultTypes", cloneNode(currentFaults));
                currentEntry.set("annotatedBy", cloneNode(currentAnnotated));
                currentEntry.set("severity", cloneNode(currentSeverity));
                currentEntry.set("comments", cloneNode(currentComments));
                currentEntry.set("boxCreatedAt", cloneNode(currentCreatedAt));
                history.add(currentEntry);

                root.set("history", history);

                byte[] metadataBytes = mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(root);

                StringBuilder csvBuilder = new StringBuilder();
                csvBuilder.append("timestamp,isCurrent,boundingBoxes,faultTypes,annotatedBy,severity,comments\n");
                for (JsonNode entry : history) {
                    String timestamp = entry.path("timestamp").isNull() ? "" : entry.path("timestamp").asText("");
                    String boxesJson = mapper.writeValueAsString(entry.path("boundingBoxes"));
                    String faultsJson = mapper.writeValueAsString(entry.path("faultTypes"));
                    String annotatedJson = mapper.writeValueAsString(entry.path("annotatedBy"));
                    String severityJson = mapper.writeValueAsString(entry.path("severity"));
                    String commentsJson = mapper.writeValueAsString(entry.path("comments"));
                    csvBuilder.append('"').append(csvEscape(timestamp)).append('"').append(',');
                    csvBuilder.append(entry.path("isCurrent").asBoolean(false) ? "true" : "false").append(',');
                    csvBuilder.append('"').append(csvEscape(boxesJson)).append('"').append(',');
                    csvBuilder.append('"').append(csvEscape(faultsJson)).append('"').append(',');
                    csvBuilder.append('"').append(csvEscape(annotatedJson)).append('"').append(',');
                    csvBuilder.append('"').append(csvEscape(severityJson)).append('"').append(',');
                    csvBuilder.append('"').append(csvEscape(commentsJson)).append('"').append('\n');
                }
                byte[] csvBytes = csvBuilder.toString().getBytes(StandardCharsets.UTF_8);

                byte[] imageBytes = decodeDataUrl(inspection.getImageUrl());
                String imageExt = guessImageExtension(inspection.getImageUrl());

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                try (ZipOutputStream zos = new ZipOutputStream(baos)) {
                    ZipEntry metadataEntry = new ZipEntry("metadata.json");
                    zos.putNextEntry(metadataEntry);
                    zos.write(metadataBytes);
                    zos.closeEntry();

                    ZipEntry csvEntry = new ZipEntry("history.csv");
                    zos.putNextEntry(csvEntry);
                    zos.write(csvBytes);
                    zos.closeEntry();

                    if (imageBytes != null && imageBytes.length > 0) {
                        ZipEntry imageEntry = new ZipEntry("image-original." + imageExt);
                        zos.putNextEntry(imageEntry);
                        zos.write(imageBytes);
                        zos.closeEntry();
                    }

                    if (baselineSelection != null) {
                        byte[] baselineBytes = decodeDataUrl(baselineSelection.dataUrl());
                        if (baselineBytes != null && baselineBytes.length > 0) {
                            String baselineExt = guessImageExtension(baselineSelection.dataUrl());
                            String weatherLabel = baselineSelection.weatherLabel() != null
                                    ? sanitizeFilename(baselineSelection.weatherLabel())
                                    : "baseline";
                            if (weatherLabel.isBlank()) {
                                weatherLabel = "baseline";
                            }
                            ZipEntry baselineEntry = new ZipEntry("baseline-" + weatherLabel + "." + baselineExt);
                            zos.putNextEntry(baselineEntry);
                            zos.write(baselineBytes);
                            zos.closeEntry();
                        }
                    }

                    writeResourceToZip(zos, "export/plot_bounding_boxes.py", "tools/plot_bounding_boxes.py");
                    writeResourceToZip(zos, "export/README.md", "tools/README.md");
                }

                byte[] zipBytes = baos.toByteArray();
                String filenameBase = inspection.getInspectionNumber();
                if (filenameBase == null || filenameBase.isBlank()) {
                    filenameBase = inspection.getId();
                }
                String safeBase = sanitizeFilename(filenameBase);
                String downloadName = safeBase + "-export.zip";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
                headers.setContentDisposition(ContentDisposition.attachment().filename(downloadName).build());
                headers.setContentLength(zipBytes.length);
                return ResponseEntity.ok().headers(headers).body(zipBytes);
            } catch (Exception ex) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Failed to export inspection"));
            }
        }).orElse(ResponseEntity.notFound().build());
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
                                    @AuthenticationPrincipal UserDetails principal,
                                    @RequestHeader(value = "x-username", required = false) String uploaderHeader) {
        return repo.findById(id).map(i -> {
            try {
                String uploader = principal != null ? principal.getUsername() : uploaderHeader;
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
                    archivePreviousAnalysis(i, "AI", null);
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
        ObjectMapper mapper = new ObjectMapper();
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
                StringBuilder sev = new StringBuilder();
                sev.append('[');
                boolean firstSev = true;
                StringBuilder created = new StringBuilder();
                created.append('[');
                boolean firstCreated = true;
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
                    // Per-box severity: extract from AI results (only AI-annotated faults have severity)
                    if (!firstSev) sev.append(',');
                    firstSev = false;
                    var severityNode = bi.path("severity");
                    if (severityNode != null && !severityNode.isMissingNode() && severityNode.isNumber()) {
                        sev.append(severityNode.asDouble());
                    } else {
                        sev.append("null");
                    }
                    if (!firstCreated) created.append(',');
                    firstCreated = false;
                    created.append('"').append(Instant.now().toString()).append('"');
                }
                sb.append(']');
                i.setFaultTypes(sb.toString());
                ann.append(']');
                i.setAnnotatedBy(ann.toString());
                sev.append(']');
                i.setSeverity(sev.toString());
                created.append(']');
                i.setBoxCreatedAt(created.toString());
            }
            // analyzed image dimensions no longer persisted
        } catch (Exception ignore) { }
        i.setRecentStatus(null);
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
        "boxCreatedAt", parseJsonNode(mapper, i.getBoxCreatedAt()),
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
    private void archivePreviousAnalysis(Inspection i, String annotatedBy, ArrayNode statusSnapshot) throws Exception {
        String boxesJson = i.getBoundingBoxes();
        String faultsJson = i.getFaultTypes();
        String severityJson = i.getSeverity();
        String commentJson = i.getComment();
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

        // severityHistory as array of snapshots aligned with boxes/faults
        ArrayNode severityHist;
        String severityHistJson = i.getSeverityHistory();
        if (severityHistJson != null && !severityHistJson.isBlank()) {
            try {
                var node = mapper.readTree(severityHistJson);
                severityHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                severityHist = mapper.createArrayNode();
            }
        } else {
            severityHist = mapper.createArrayNode();
        }
        if (severityJson != null && !severityJson.isBlank()) {
            try {
                severityHist.add(mapper.readTree(severityJson));
            } catch (Exception ex) {
                severityHist.addNull();
            }
        } else {
            severityHist.addNull();
        }

        // commentHistory as array of snapshots aligned with boxes/faults
        ArrayNode commentHist;
        String commentHistJson = i.getCommentHistory();
        if (commentHistJson != null && !commentHistJson.isBlank()) {
            try {
                var node = mapper.readTree(commentHistJson);
                commentHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                commentHist = mapper.createArrayNode();
            }
        } else {
            commentHist = mapper.createArrayNode();
        }
        if (commentJson != null && !commentJson.isBlank()) {
            try {
                commentHist.add(mapper.readTree(commentJson));
            } catch (Exception ex) {
                commentHist.addNull();
            }
        } else {
            commentHist.addNull();
        }

        // boxCreatedAtHistory aligns creation timestamps with snapshots
        ArrayNode createdHist;
        String createdHistJson = i.getBoxCreatedAtHistory();
        if (createdHistJson != null && !createdHistJson.isBlank()) {
            try {
                var node = mapper.readTree(createdHistJson);
                createdHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                createdHist = mapper.createArrayNode();
            }
        } else {
            createdHist = mapper.createArrayNode();
        }
        String createdJson = i.getBoxCreatedAt();
        if (createdJson != null && !createdJson.isBlank()) {
            try {
                createdHist.add(mapper.readTree(createdJson));
            } catch (Exception ex) {
                createdHist.addNull();
            }
        } else {
            createdHist.addNull();
        }

        // recentStatusHistory captures per-box recent status flags aligned with snapshots
        ArrayNode statusHist;
        String statusHistJson = i.getRecentStatusHistory();
        if (statusHistJson != null && !statusHistJson.isBlank()) {
            try {
                var node = mapper.readTree(statusHistJson);
                statusHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                statusHist = mapper.createArrayNode();
            }
        } else {
            statusHist = mapper.createArrayNode();
        }

        ArrayNode statusToArchive = null;
        if (statusSnapshot != null) {
            statusToArchive = statusSnapshot.deepCopy();
        } else {
            String recentStatusJson = i.getRecentStatus();
            if (recentStatusJson != null && !recentStatusJson.isBlank()) {
                try {
                    JsonNode statusNode = mapper.readTree(recentStatusJson);
                    if (statusNode instanceof ArrayNode) {
                        statusToArchive = ((ArrayNode) statusNode).deepCopy();
                    }
                } catch (Exception ignore) { }
            }
        }
        if (statusToArchive != null && hasMeaningfulStatus(statusToArchive)) {
            statusHist.add(statusToArchive);
        } else {
            statusHist.addNull();
        }

        // timestampHistory records when each snapshot was archived
        ArrayNode timestampHist;
        String timestampHistJson = i.getTimestampHistory();
        if (timestampHistJson != null && !timestampHistJson.isBlank()) {
            try {
                var node = mapper.readTree(timestampHistJson);
                timestampHist = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
            } catch (Exception ex) {
                timestampHist = mapper.createArrayNode();
            }
        } else {
            timestampHist = mapper.createArrayNode();
        }
        timestampHist.add(Instant.now().toString());

        // Persist updated histories ensuring alignment/order
        i.setBoundingBoxHistory(boxHist.toString());
        i.setFaultTypeHistory(faultHist.toString());
        i.setAnnotatedByHistory(annotatedHist.toString());
        i.setSeverityHistory(severityHist.toString());
        i.setCommentHistory(commentHist.toString());
    i.setBoxCreatedAtHistory(createdHist.toString());
        i.setRecentStatusHistory(statusHist.toString());
        i.setTimestampHistory(timestampHist.toString());
    }

    private static void putNullable(ObjectNode node, String field, String value) {
        if (value == null) {
            node.putNull(field);
        } else {
            node.put(field, value);
        }
    }

    private static JsonNode parseJsonNode(ObjectMapper mapper, String raw) {
        if (raw == null || raw.isBlank()) {
            return NullNode.getInstance();
        }
        try {
            JsonNode node = mapper.readTree(raw);
            return node == null ? NullNode.getInstance() : node;
        } catch (Exception ex) {
            return NullNode.getInstance();
        }
    }

    private static JsonNode cloneNode(JsonNode node) {
        if (node == null || node.isMissingNode()) {
            return NullNode.getInstance();
        }
        return node.deepCopy();
    }

    private static ArrayNode asArrayNode(JsonNode node) {
        return node instanceof ArrayNode ? (ArrayNode) node : null;
    }

    private static JsonNode snapshotValue(ArrayNode array, int index) {
        if (array == null || index < 0 || index >= array.size()) {
            return NullNode.getInstance();
        }
        JsonNode node = array.get(index);
        return node == null ? NullNode.getInstance() : node;
    }

    private static int maxSize(ArrayNode... arrays) {
        int max = 0;
        if (arrays == null) {
            return 0;
        }
        for (ArrayNode array : arrays) {
            if (array != null && array.size() > max) {
                max = array.size();
            }
        }
        return max;
    }

    private static String extractText(ArrayNode array, int index) {
        if (array == null || index < 0 || index >= array.size()) {
            return null;
        }
        JsonNode node = array.get(index);
        return node != null && node.isValueNode() ? node.asText() : null;
    }

    private static ArrayNode parseArrayNode(ObjectMapper mapper, String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            JsonNode node = mapper.readTree(json);
            return node instanceof ArrayNode ? (ArrayNode) node : null;
        } catch (Exception ex) {
            return null;
        }
    }

    private static StatusDiff computeStatusDiff(ArrayNode previousBoxes,
                                                ArrayNode previousFaults,
                                                ArrayNode previousComments,
                                                ArrayNode currentBoxes,
                                                ArrayNode currentFaults,
                                                ArrayNode currentComments,
                                                ObjectMapper mapper) {
        List<BoxDescriptor> prevDescriptors = buildDescriptors(previousBoxes, previousFaults, previousComments);
        List<BoxDescriptor> currDescriptors = buildDescriptors(currentBoxes, currentFaults, currentComments);

        List<String> currentFlags = new ArrayList<>();
        for (int idx = 0; idx < currDescriptors.size(); idx++) {
            currentFlags.add(null);
        }
        List<String> historyFlags = new ArrayList<>();
        for (int idx = 0; idx < prevDescriptors.size(); idx++) {
            historyFlags.add(null);
        }
        int[] currentToPrevious = new int[currDescriptors.size()];
        Arrays.fill(currentToPrevious, -1);
        int[] previousToCurrent = new int[prevDescriptors.size()];
        Arrays.fill(previousToCurrent, -1);

        // Step 1: exact matches
        for (int idx = 0; idx < currDescriptors.size(); idx++) {
            BoxDescriptor curr = currDescriptors.get(idx);
            if (curr == null) {
                continue;
            }
            int matchIdx = findMatching(prevDescriptors, curr, true);
            if (matchIdx >= 0) {
                BoxDescriptor prev = prevDescriptors.get(matchIdx);
                recordMatch(curr, prev, currentToPrevious, previousToCurrent);
                prev.matched = true;
                curr.matched = true;
            }
        }

        // Step 2: match by index
        for (int idx = 0; idx < currDescriptors.size(); idx++) {
            BoxDescriptor curr = currDescriptors.get(idx);
            if (curr == null || curr.matched) {
                continue;
            }
            if (curr.index >= 0 && curr.index < prevDescriptors.size()) {
                BoxDescriptor prev = prevDescriptors.get(curr.index);
                if (prev != null && !prev.matched) {
                    markEdited(curr, prev, currentFlags, historyFlags, currentToPrevious, previousToCurrent);
                }
            }
        }

        // Step 3: relaxed geometry matches
        for (int idx = 0; idx < currDescriptors.size(); idx++) {
            BoxDescriptor curr = currDescriptors.get(idx);
            if (curr == null || curr.matched) {
                continue;
            }
            int matchIdx = findMatching(prevDescriptors, curr, false);
            if (matchIdx >= 0) {
                BoxDescriptor prev = prevDescriptors.get(matchIdx);
                if (prev != null && !prev.matched) {
                    markEdited(curr, prev, currentFlags, historyFlags, currentToPrevious, previousToCurrent);
                }
            }
        }

        // Step 4: remaining are added
        for (int idx = 0; idx < currDescriptors.size(); idx++) {
            BoxDescriptor curr = currDescriptors.get(idx);
            if (curr == null) {
                continue;
            }
            if (!curr.matched) {
                currentFlags.set(curr.index, "added");
                curr.matched = true;
            }
        }

        // Step 5: previous unmatched entries are deleted
        for (int idx = 0; idx < prevDescriptors.size(); idx++) {
            BoxDescriptor prev = prevDescriptors.get(idx);
            if (prev != null && !prev.matched) {
                historyFlags.set(prev.index, "deleted");
            }
        }

        ArrayNode currentStatus = mapper.createArrayNode();
        for (String flag : currentFlags) {
            if (flag == null || flag.isBlank()) {
                currentStatus.addNull();
            } else {
                currentStatus.add(flag);
            }
        }

        ArrayNode historyStatus = mapper.createArrayNode();
        for (String flag : historyFlags) {
            if (flag == null || flag.isBlank()) {
                historyStatus.addNull();
            } else {
                historyStatus.add(flag);
            }
        }

    return new StatusDiff(currentStatus, historyStatus, currentToPrevious, previousToCurrent);
    }

    private static List<BoxDescriptor> buildDescriptors(ArrayNode boxes,
                                                        ArrayNode faults,
                                                        ArrayNode comments) {
        int count = boxes != null ? boxes.size() : 0;
        List<BoxDescriptor> descriptors = new ArrayList<>();
        for (int idx = 0; idx < count; idx++) {
            descriptors.add(null);
        }
        if (boxes == null) {
            return descriptors;
        }
        for (int idx = 0; idx < count; idx++) {
            JsonNode box = boxes.get(idx);
            if (!(box instanceof ArrayNode) || box.size() < 4) {
                continue;
            }
            double x = box.get(0).asDouble();
            double y = box.get(1).asDouble();
            double w = box.get(2).asDouble();
            double h = box.get(3).asDouble();
            String fault = faults != null && idx < faults.size() && faults.get(idx) != null && !faults.get(idx).isNull()
                    ? faults.get(idx).asText("none")
                    : "none";
            String comment = null;
            if (comments != null && idx < comments.size()) {
                JsonNode commentNode = comments.get(idx);
                if (commentNode != null && !commentNode.isNull()) {
                    String raw = commentNode.asText(null);
                    if (raw != null) {
                        String trimmed = raw.trim();
                        if (!trimmed.isEmpty()) {
                            comment = trimmed;
                        }
                    }
                }
            }
            descriptors.set(idx, new BoxDescriptor(idx, x, y, w, h, fault, comment));
        }
        return descriptors;
    }

    private static void markEdited(BoxDescriptor curr,
                                   BoxDescriptor prev,
                                   List<String> currentFlags,
                                   List<String> historyFlags,
                                   int[] currentToPrevious,
                                   int[] previousToCurrent) {
        prev.matched = true;
        curr.matched = true;
        recordMatch(curr, prev, currentToPrevious, previousToCurrent);
        if (curr.index >= 0 && curr.index < currentFlags.size()) {
            currentFlags.set(curr.index, "edited");
        }
        if (prev.index >= 0 && prev.index < historyFlags.size()) {
            historyFlags.set(prev.index, "edited");
        }
    }

    private static void recordMatch(BoxDescriptor curr,
                                    BoxDescriptor prev,
                                    int[] currentToPrevious,
                                    int[] previousToCurrent) {
        if (curr.index >= 0 && curr.index < currentToPrevious.length) {
            currentToPrevious[curr.index] = prev.index;
        }
        if (prev.index >= 0 && prev.index < previousToCurrent.length) {
            previousToCurrent[prev.index] = curr.index;
        }
    }

    private static int findMatching(List<BoxDescriptor> candidates,
                                    BoxDescriptor target,
                                    boolean requireAttributes) {
        int bestIndex = -1;
        double bestScore = Double.MAX_VALUE;
        for (int idx = 0; idx < candidates.size(); idx++) {
            BoxDescriptor candidate = candidates.get(idx);
            if (candidate == null || candidate.matched) {
                continue;
            }
            if (!geometryClose(candidate, target, BOX_MATCH_EPSILON)) {
                continue;
            }
            if (requireAttributes && !attributesEqual(candidate, target)) {
                continue;
            }
            double score = geometryDistance(candidate, target);
            if (score < bestScore) {
                bestScore = score;
                bestIndex = idx;
            }
        }
        return bestIndex;
    }

    private static boolean attributesEqual(BoxDescriptor a, BoxDescriptor b) {
        return faultEquals(a.fault, b.fault) && commentEquals(a.comment, b.comment);
    }

    private static boolean faultEquals(String a, String b) {
        String fa = a == null ? "none" : a.trim();
        String fb = b == null ? "none" : b.trim();
        return fa.equalsIgnoreCase(fb);
    }

    private static boolean commentEquals(String a, String b) {
        if (a == null || a.isBlank()) {
            return b == null || b.isBlank();
        }
        if (b == null || b.isBlank()) {
            return false;
        }
        return a.equals(b);
    }

    private static double geometryDistance(BoxDescriptor a, BoxDescriptor b) {
        double dx = Math.abs(a.x - b.x);
        double dy = Math.abs(a.y - b.y);
        double dw = Math.abs(a.w - b.w);
        double dh = Math.abs(a.h - b.h);
        return dx + dy + dw + dh;
    }

    private static boolean geometryClose(BoxDescriptor a, BoxDescriptor b, double epsilon) {
        return Math.abs(a.x - b.x) <= epsilon
                && Math.abs(a.y - b.y) <= epsilon
                && Math.abs(a.w - b.w) <= epsilon
                && Math.abs(a.h - b.h) <= epsilon;
    }

    private record StatusDiff(ArrayNode currentStatus,
                              ArrayNode historyStatus,
                              int[] currentToPrevious,
                              int[] previousToCurrent) {}

    private static final class BoxDescriptor {
        final int index;
        final double x;
        final double y;
        final double w;
        final double h;
        final String fault;
        final String comment;
        boolean matched;

        BoxDescriptor(int index, double x, double y, double w, double h, String fault, String comment) {
            this.index = index;
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.fault = fault == null ? "none" : fault;
            this.comment = comment;
            this.matched = false;
        }
    }

    private static String csvEscape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\"", "\"\"")
                .replace('\n', ' ')
                .replace('\r', ' ');
    }

    private static boolean hasMeaningfulStatus(ArrayNode node) {
        if (node == null) {
            return false;
        }
        for (JsonNode entry : node) {
            if (entry != null && !entry.isNull()) {
                String text = entry.asText(null);
                if (text != null && !text.isBlank()) {
                    return true;
                }
            }
        }
        return false;
    }

    private static byte[] decodeDataUrl(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            return null;
        }
        int comma = dataUrl.indexOf(',');
        if (comma < 0) {
            return null;
        }
        String base64 = dataUrl.substring(comma + 1);
        try {
            return Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String guessImageExtension(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            return "bin";
        }
        int colon = dataUrl.indexOf(':');
        int semi = dataUrl.indexOf(';');
        if (colon >= 0 && semi > colon) {
            String mime = dataUrl.substring(colon + 1, semi).toLowerCase();
            switch (mime) {
                case "image/png":
                    return "png";
                case "image/jpeg":
                case "image/jpg":
                    return "jpg";
                case "image/webp":
                    return "webp";
                default:
                    return "bin";
            }
        }
        return "bin";
    }

    private static String sanitizeFilename(String value) {
        if (value == null || value.isBlank()) {
            return "inspection";
        }
        String sanitized = value.replaceAll("[^A-Za-z0-9._-]", "_");
        return sanitized.isBlank() ? "inspection" : sanitized;
    }

    private static BaselineSelection resolveBaselineSelection(Inspection inspection) {
        if (inspection == null) {
            return null;
        }
        Transformer transformer = inspection.getTransformer();
        if (transformer == null) {
            return null;
        }
        String preferredWeather = determinePreferredWeather(inspection);
        if (StringUtils.hasText(preferredWeather)) {
            String candidate = lookupBaselineForWeather(transformer, preferredWeather);
            if (StringUtils.hasText(candidate)) {
                return new BaselineSelection(candidate, preferredWeather.toLowerCase(Locale.ROOT));
            }
        }
        if (StringUtils.hasText(transformer.getSunnyImage())) {
            return new BaselineSelection(transformer.getSunnyImage(), "sunny");
        }
        if (StringUtils.hasText(transformer.getCloudyImage())) {
            return new BaselineSelection(transformer.getCloudyImage(), "cloudy");
        }
        if (StringUtils.hasText(transformer.getWindyImage())) {
            return new BaselineSelection(transformer.getWindyImage(), "windy");
        }
        return null;
    }

    private static String determinePreferredWeather(Inspection inspection) {
        String weather = inspection.getLastAnalysisWeather();
        if (!StringUtils.hasText(weather)) {
            weather = inspection.getWeather();
        }
        if (!StringUtils.hasText(weather)) {
            return null;
        }
        return weather.trim().toLowerCase(Locale.ROOT);
    }

    private static String lookupBaselineForWeather(Transformer transformer, String weather) {
        if (!StringUtils.hasText(weather) || transformer == null) {
            return null;
        }
        return switch (weather.toLowerCase(Locale.ROOT)) {
            case "sunny" -> transformer.getSunnyImage();
            case "cloudy" -> transformer.getCloudyImage();
            case "rainy", "windy" -> transformer.getWindyImage();
            default -> null;
        };
    }

    private static void writeResourceToZip(ZipOutputStream zos, String resourcePath, String entryName) throws IOException {
        ClassPathResource resource = new ClassPathResource(resourcePath);
        if (!resource.exists()) {
            return;
        }
        ZipEntry entry = new ZipEntry(entryName);
        zos.putNextEntry(entry);
        try (InputStream is = resource.getInputStream()) {
            is.transferTo(zos);
        }
        zos.closeEntry();
    }

    private record BaselineSelection(String dataUrl, String weatherLabel) {}

    private static final double BOX_MATCH_EPSILON = 0.5;

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
                // Clear history fields as requested
                i.setFaultTypeHistory(null);
                i.setBoundingBoxHistory(null);
                i.setAnnotatedBy(null);
                i.setAnnotatedByHistory(null);
                i.setSeverity(null);
                i.setSeverityHistory(null);
                i.setComment(null);
                i.setCommentHistory(null);
                i.setTimestampHistory(null);
                i.setRecentStatus(null);
                i.setRecentStatusHistory(null);
                i.setBoxCreatedAt(null);
                i.setBoxCreatedAtHistory(null);
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
                ArrayNode statusSnapshot = mapper.createArrayNode();
                for (int idx = 0; idx < arr.size(); idx++) {
                    if (idx == index) {
                        statusSnapshot.add("deleted");
                    } else {
                        statusSnapshot.addNull();
                    }
                }
                try { archivePreviousAnalysis(i, username == null || username.isBlank() ? "user" : username, statusSnapshot); } catch (Exception ignore) { }
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

                // Update severity array to maintain alignment
                String sevJson = i.getSeverity();
                if (sevJson != null && !sevJson.isBlank()) {
                    try {
                        JsonNode sevNode = mapper.readTree(sevJson);
                        if (sevNode instanceof ArrayNode) {
                            ArrayNode sevArr = (ArrayNode) sevNode;
                            if (index >= 0 && index < sevArr.size()) {
                                sevArr.remove(index);
                                i.setSeverity(sevArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed severity */ }
                }

                // Update comment array to maintain alignment
                String commentJson = i.getComment();
                if (commentJson != null && !commentJson.isBlank()) {
                    try {
                        JsonNode commentNode = mapper.readTree(commentJson);
                        if (commentNode instanceof ArrayNode) {
                            ArrayNode commentArr = (ArrayNode) commentNode;
                            if (index >= 0 && index < commentArr.size()) {
                                commentArr.remove(index);
                                i.setComment(commentArr.isEmpty() ? null : commentArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed comment */ }
                }

                String createdJson = i.getBoxCreatedAt();
                if (createdJson != null && !createdJson.isBlank()) {
                    try {
                        JsonNode createdNode = mapper.readTree(createdJson);
                        if (createdNode instanceof ArrayNode) {
                            ArrayNode createdArr = (ArrayNode) createdNode;
                            if (index >= 0 && index < createdArr.size()) {
                                createdArr.remove(index);
                                i.setBoxCreatedAt(createdArr.isEmpty() ? null : createdArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed boxCreatedAt */ }
                }

                // Clear recent status for current state; deletion is represented only in history
                i.setRecentStatus(null);

                repo.save(i);
                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "boundingBoxes", arr,
                        "faultTypes", i.getFaultTypes(),
            "recentStatus", null,
            "boxCreatedAt", parseJsonNode(mapper, i.getBoxCreatedAt())));
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
                ArrayNode statusSnapshot = mapper.createArrayNode();
                for (int idx = 0; idx < arr.size(); idx++) {
                    if (idx == matchIdx) {
                        statusSnapshot.add("deleted");
                    } else {
                        statusSnapshot.addNull();
                    }
                }
                try { archivePreviousAnalysis(i, username == null || username.isBlank() ? "user" : username, statusSnapshot); } catch (Exception ignore) { }
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

                // Update severity alignment
                String sevJson = i.getSeverity();
                if (sevJson != null && !sevJson.isBlank()) {
                    try {
                        JsonNode sevNode = mapper.readTree(sevJson);
                        if (sevNode instanceof ArrayNode) {
                            ArrayNode sevArr = (ArrayNode) sevNode;
                            if (matchIdx >= 0 && matchIdx < sevArr.size()) {
                                sevArr.remove(matchIdx);
                                i.setSeverity(sevArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed severity */ }
                }

                // Update comment alignment
                String commentJson = i.getComment();
                if (commentJson != null && !commentJson.isBlank()) {
                    try {
                        JsonNode commentNode = mapper.readTree(commentJson);
                        if (commentNode instanceof ArrayNode) {
                            ArrayNode commentArr = (ArrayNode) commentNode;
                            if (matchIdx >= 0 && matchIdx < commentArr.size()) {
                                commentArr.remove(matchIdx);
                                i.setComment(commentArr.isEmpty() ? null : commentArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed comment */ }
                }

                String createdJson = i.getBoxCreatedAt();
                if (createdJson != null && !createdJson.isBlank()) {
                    try {
                        JsonNode createdNode = mapper.readTree(createdJson);
                        if (createdNode instanceof ArrayNode) {
                            ArrayNode createdArr = (ArrayNode) createdNode;
                            if (matchIdx >= 0 && matchIdx < createdArr.size()) {
                                createdArr.remove(matchIdx);
                                i.setBoxCreatedAt(createdArr.isEmpty() ? null : createdArr.toString());
                            }
                        }
                    } catch (Exception ignore) { /* ignore malformed boxCreatedAt */ }
                }

                i.setRecentStatus(null);

                repo.save(i);
                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "boundingBoxes", arr,
                        "faultTypes", i.getFaultTypes(),
            "recentStatus", null,
            "boxCreatedAt", parseJsonNode(mapper, i.getBoxCreatedAt())));
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
                try { archivePreviousAnalysis(i, username == null || username.isBlank() ? "user" : username, null); } catch (Exception ignore) { }
                double x = ((Number)payload.getOrDefault("x", 0)).doubleValue();
                double y = ((Number)payload.getOrDefault("y", 0)).doubleValue();
                double w = ((Number)payload.getOrDefault("w", 0)).doubleValue();
                double h = ((Number)payload.getOrDefault("h", 0)).doubleValue();
                String faultType = String.valueOf(payload.getOrDefault("faultType", "none"));
                Object rawComment = payload.get("comment");
                String commentValue = null;
                if (rawComment instanceof String) {
                    String trimmed = ((String) rawComment).trim();
                    if (!trimmed.isEmpty()) {
                        commentValue = trimmed;
                    }
                }

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

                // Update severity array aligned with boxes (user-added boxes have null severity)
                ArrayNode sevArr;
                String sevJson = i.getSeverity();
                if (sevJson != null && !sevJson.isBlank()) {
                    try {
                        var node = mapper.readTree(sevJson);
                        sevArr = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
                    } catch (Exception ex) {
                        sevArr = mapper.createArrayNode();
                    }
                } else {
                    sevArr = mapper.createArrayNode();
                }
                sevArr.addNull(); // User-added boxes have null severity
                i.setSeverity(sevArr.toString());

                // Update comment array aligned with boxes
                ArrayNode commentArr;
                String commentJson = i.getComment();
                if (commentJson != null && !commentJson.isBlank()) {
                    try {
                        var node = mapper.readTree(commentJson);
                        commentArr = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
                    } catch (Exception ex) {
                        commentArr = mapper.createArrayNode();
                    }
                } else {
                    commentArr = mapper.createArrayNode();
                }
                if (commentValue != null) {
                    commentArr.add(commentValue);
                } else {
                    commentArr.addNull();
                }
                i.setComment(commentArr.isEmpty() ? null : commentArr.toString());

                ArrayNode createdArr;
                String createdJson = i.getBoxCreatedAt();
                if (createdJson != null && !createdJson.isBlank()) {
                    try {
                        var node = mapper.readTree(createdJson);
                        createdArr = node instanceof ArrayNode ? (ArrayNode) node : mapper.createArrayNode();
                    } catch (Exception ex) {
                        createdArr = mapper.createArrayNode();
                    }
                } else {
                    createdArr = mapper.createArrayNode();
                }
                while (createdArr.size() < boxesArr.size() - 1) {
                    createdArr.addNull();
                }
                createdArr.add(Instant.now().toString());
                i.setBoxCreatedAt(createdArr.isEmpty() ? null : createdArr.toString());

                ArrayNode statusArr = mapper.createArrayNode();
                for (int idx = 0; idx < boxesArr.size(); idx++) {
                    if (idx == boxesArr.size() - 1) {
                        statusArr.add("added");
                    } else {
                        statusArr.addNull();
                    }
                }
                i.setRecentStatus(hasMeaningfulStatus(statusArr) ? statusArr.toString() : null);

                repo.save(i);
                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "boundingBoxes", boxesArr,
                        "faultTypes", ftArr,
                        "comments", commentArr,
            "recentStatus", statusArr,
            "boxCreatedAt", createdArr));
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
                String previousBoxes = i.getBoundingBoxes();
                String previousFaults = i.getFaultTypes();
                String previousAnnotated = i.getAnnotatedBy();
                String previousComments = i.getComment();
                String actor = username == null || username.isBlank() ? "user" : username;
                ObjectMapper mapper = new ObjectMapper();
                ArrayNode prevBoxesNode = parseArrayNode(mapper, previousBoxes);
                ArrayNode prevFaultsNode = parseArrayNode(mapper, previousFaults);
                ArrayNode prevCommentsNode = parseArrayNode(mapper, previousComments);
                ArrayNode prevCreatedNode = parseArrayNode(mapper, i.getBoxCreatedAt());
                
                // Parse incoming boxes, faultTypes, and annotatedBy from request
                var boxesPayload = payload.get("boundingBoxes");
                var faultsPayload = payload.get("faultTypes");
                var annotatedByPayload = payload.get("annotatedBy");
                var commentsPayload = payload.get("comments");
                var tuneModelPayload = payload.get("tuneModel");
                boolean tuneModel = true;
                if (tuneModelPayload instanceof Boolean) {
                    tuneModel = (Boolean) tuneModelPayload;
                } else if (tuneModelPayload instanceof String) {
                    tuneModel = Boolean.parseBoolean((String) tuneModelPayload);
                }

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
                        finalAnnotated.add(ann != null ? ann.toString() : actor);
                    }
                } else {
                    // Fallback: fill with username for all boxes
                    String who = actor;
                    for (int k = 0; k < finalFaults.size(); k++) {
                        finalAnnotated.add(who);
                    }
                }

                ArrayNode finalComments = mapper.createArrayNode();
                if (commentsPayload instanceof List) {
                    for (Object commentObj : (List<?>) commentsPayload) {
                        if (commentObj == null) {
                            finalComments.addNull();
                        } else {
                            String text = commentObj.toString().trim();
                            finalComments.add(text.isEmpty() ? null : text);
                        }
                    }
                }
                while (finalComments.size() < finalBoxes.size()) {
                    finalComments.addNull();
                }
                while (finalComments.size() > finalBoxes.size()) {
                    finalComments.remove(finalComments.size() - 1);
                }
                boolean hasCommentValue = false;
                for (JsonNode node : finalComments) {
                    if (node != null && !node.isNull() && !node.asText("").isBlank()) {
                        hasCommentValue = true;
                        break;
                    }
                }

                StatusDiff statusDiff = computeStatusDiff(
                        prevBoxesNode,
                        prevFaultsNode,
                        prevCommentsNode,
                        finalBoxes,
                        finalFaults,
                        finalComments,
                        mapper);

                ArrayNode historyStatusSnapshot = statusDiff.historyStatus();
                ArrayNode currentStatusSnapshot = statusDiff.currentStatus();

                ArrayNode finalCreatedAt = mapper.createArrayNode();
                int[] currentToPrevious = statusDiff.currentToPrevious();
                for (int idx = 0; idx < finalBoxes.size(); idx++) {
                    String ts = null;
                    if (idx < currentToPrevious.length) {
                        int prevIdx = currentToPrevious[idx];
                        if (prevIdx >= 0 && prevCreatedNode != null && prevIdx < prevCreatedNode.size()) {
                            JsonNode prevTs = prevCreatedNode.get(prevIdx);
                            if (prevTs != null && !prevTs.isNull()) {
                                ts = prevTs.asText(null);
                            }
                        }
                    }
                    if (ts == null || ts.isBlank()) {
                        ts = Instant.now().toString();
                    }
                    finalCreatedAt.add(ts);
                }
                String finalCreatedJson = finalCreatedAt.size() == 0 ? null : finalCreatedAt.toString();

                try { archivePreviousAnalysis(i, actor, historyStatusSnapshot); } catch (Exception ignore) { }

                String finalBoxesJson = finalBoxes.toString();
                String finalFaultsJson = finalFaults.toString();
                String finalAnnotatedJson = finalAnnotated.toString();
                String finalCommentsJson = hasCommentValue ? finalComments.toString() : null;

                // Persist final state
                i.setBoundingBoxes(finalBoxesJson);
                i.setFaultTypes(finalFaultsJson);
                i.setAnnotatedBy(finalAnnotatedJson);
                i.setComment(finalCommentsJson);
                i.setBoxCreatedAt(finalCreatedJson);
                i.setRecentStatus(hasMeaningfulStatus(currentStatusSnapshot) ? currentStatusSnapshot.toString() : null);
                repo.save(i);

                if (tuneModel) {
                    parameterTuningService.processBulkUpdateFeedback(
                            i,
                            previousBoxes,
                            previousFaults,
                            previousAnnotated,
                            finalBoxesJson,
                            finalFaultsJson,
                            finalAnnotatedJson
                    );
                }

                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "boundingBoxes", finalBoxes,
                        "faultTypes", finalFaults,
                        "comments", finalComments,
            "recentStatus", currentStatusSnapshot,
            "boxCreatedAt", finalCreatedAt));
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body(Map.of("error", "Bulk update failed"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/model/reset")
    public ResponseEntity<?> resetModelParameters(@RequestHeader(value = "x-username", required = false) String username) {
        try {
            aiParameterService.resetToDefaults();
            Map<String, Double> parameters = aiParameterService.getAllParameters();
            return ResponseEntity.ok(Map.of(
                    "ok", Boolean.TRUE,
                    "parameters", parameters,
                    "resetBy", (username == null || username.isBlank()) ? "user" : username
            ));
        } catch (Exception ex) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to reset model parameters"));
        }
    }

    // No-op
}
