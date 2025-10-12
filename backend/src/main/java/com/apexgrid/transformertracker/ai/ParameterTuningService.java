package com.apexgrid.transformertracker.ai;

import com.apexgrid.transformertracker.model.Inspection;
import com.apexgrid.transformertracker.model.ParameterFeedback;
import com.apexgrid.transformertracker.repo.ParameterFeedbackRepo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Locale;
import java.util.List;
import java.util.Map;

@Service
public class ParameterTuningService {
    private static final Logger LOG = LoggerFactory.getLogger(ParameterTuningService.class);

    private static final double BOX_TOLERANCE = 0.5;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ParameterFeedbackRepo feedbackRepo;
    private final AiParameterService parameterService;

    @Value("${app.ai.python:python}")
    private String pythonCommand;

    @Value("${app.ai.tuning-script:./AI/tune_parameters.py}")
    private String tuningScriptPath;

    public ParameterTuningService(ParameterFeedbackRepo feedbackRepo, AiParameterService parameterService) {
        this.feedbackRepo = feedbackRepo;
        this.parameterService = parameterService;
    }

    public void processBulkUpdateFeedback(Inspection inspection,
                                          String previousBoxes,
                                          String previousFaults,
                                          String previousAnnotated,
                                          String finalBoxes,
                                          String finalFaults,
                                          String finalAnnotated) {
        if (!StringUtils.hasText(previousBoxes) || !StringUtils.hasText(finalBoxes)) {
            return;
        }
        try {
            JsonNode prevBoxesNode = mapper.readTree(previousBoxes);
            JsonNode finalBoxesNode = mapper.readTree(finalBoxes);
            if (!(prevBoxesNode instanceof ArrayNode) || !(finalBoxesNode instanceof ArrayNode)) {
                return;
            }
            if (prevBoxesNode.equals(finalBoxesNode)) {
                return;
            }
            if (!containsAiAnnotation(previousAnnotated)) {
                return;
            }

            List<BoxCoord> prevCoords = parseBoxes((ArrayNode) prevBoxesNode);
            List<BoxCoord> finalCoords = parseBoxes((ArrayNode) finalBoxesNode);
            if (prevCoords.isEmpty() && finalCoords.isEmpty()) {
                return;
            }

            List<BoxCoord> removed = diffBoxes(prevCoords, finalCoords);
            List<BoxCoord> added = diffBoxes(finalCoords, prevCoords);

            if (removed.isEmpty() && added.isEmpty()) {
                return;
            }

            int aiBoxCount = prevCoords.size();
            int userBoxCount = finalCoords.size();
            int diff = userBoxCount - aiBoxCount;
            String defaultNotes = buildDefaultNotes(added.size(), removed.size(), aiBoxCount, userBoxCount);
            String notes = defaultNotes;

            BufferedImage candidate = loadCandidateImage(inspection.getImageUrl());
            if (candidate == null) {
                LOG.debug("Skipping tuning for inspection {} because candidate image is unavailable", inspection.getId());
                return;
            }

            Map<String, Double> paramsSnapshot = parameterService.getAllParameters();

            File tempDir = Files.createTempDirectory("tt-tune-").toFile();
            File candidateFile = new File(tempDir, "candidate.png");
            File payloadFile = new File(tempDir, "payload.json");

            try {
                ImageIO.write(candidate, "png", candidateFile);

                ObjectNode payload = mapper.createObjectNode();
                payload.put("inspectionId", inspection.getId().toString());
                payload.set("previousBoxes", prevBoxesNode);
                payload.set("finalBoxes", finalBoxesNode);
                payload.set("addedBoxes", boxesToArrayNode(added));
                payload.set("removedBoxes", boxesToArrayNode(removed));
                payload.put("aiBoxCount", aiBoxCount);
                payload.put("userBoxCount", userBoxCount);
                payload.put("boxTolerance", BOX_TOLERANCE);
                payload.put("imageWidth", candidate.getWidth());
                payload.put("imageHeight", candidate.getHeight());
                if (StringUtils.hasText(previousAnnotated)) {
                    payload.put("previousAnnotated", previousAnnotated);
                }
                if (StringUtils.hasText(finalAnnotated)) {
                    payload.put("finalAnnotated", finalAnnotated);
                }

                ObjectNode paramsNode = mapper.createObjectNode();
                paramsSnapshot.forEach(paramsNode::put);
                payload.set("parameters", paramsNode);

                mapper.writeValue(payloadFile, payload);

                JsonNode scriptResult = invokePythonTuner(candidateFile, payloadFile);
                if (scriptResult != null) {
                    applyParameterUpdates(scriptResult.path("parameter_updates"));
                    JsonNode notesNode = scriptResult.path("notes");
                    if (notesNode.isTextual()) {
                        notes = notesNode.asText();
                    }
                }
            } finally {
                try { Files.deleteIfExists(candidateFile.toPath()); } catch (Exception ignored) { }
                try { Files.deleteIfExists(payloadFile.toPath()); } catch (Exception ignored) { }
                try { Files.deleteIfExists(tempDir.toPath()); } catch (Exception ignored) { }
            }

            ParameterFeedback feedback = new ParameterFeedback(
                    inspection.getId(),
                    aiBoxCount,
                    userBoxCount,
                    diff,
                    previousBoxes,
                    finalBoxes,
                    previousFaults,
                    finalFaults,
                    previousAnnotated,
                    finalAnnotated,
            notes
            );

            try {
                feedbackRepo.save(feedback);
            } catch (Exception saveEx) {
                LOG.warn("Failed to persist tuning feedback for inspection {}", inspection.getId(), saveEx);
            }
        } catch (Exception ex) {
            LOG.warn("Unable to process tuning feedback for inspection {}", inspection.getId(), ex);
        }
    }

    private boolean containsAiAnnotation(String annotatedJson) {
        if (!StringUtils.hasText(annotatedJson)) {
            return false;
        }
        try {
            JsonNode node = mapper.readTree(annotatedJson);
            if (node == null) {
                return false;
            }
            if (node.isArray()) {
                for (JsonNode child : node) {
                    if (child != null && child.isTextual() && "AI".equalsIgnoreCase(child.asText())) {
                        return true;
                    }
                }
            } else if (node.isTextual()) {
                return "AI".equalsIgnoreCase(node.asText());
            }
        } catch (Exception ignored) {
            // ignore malformed annotation payloads
        }
        return false;
    }

    private List<BoxCoord> parseBoxes(ArrayNode array) {
        List<BoxCoord> boxes = new ArrayList<>();
        for (JsonNode node : array) {
            if (node != null && node.isArray() && node.size() >= 4) {
                double x = node.get(0).asDouble();
                double y = node.get(1).asDouble();
                double w = node.get(2).asDouble();
                double h = node.get(3).asDouble();
                if (w > 0 && h > 0) {
                    boxes.add(new BoxCoord(x, y, w, h));
                }
            }
        }
        return boxes;
    }

    private List<BoxCoord> diffBoxes(List<BoxCoord> primary, List<BoxCoord> reference) {
        List<BoxCoord> result = new ArrayList<>();
        for (BoxCoord candidate : primary) {
            if (!containsBox(reference, candidate)) {
                result.add(candidate);
            }
        }
        return result;
    }

    private boolean containsBox(List<BoxCoord> boxes, BoxCoord target) {
        for (BoxCoord candidate : boxes) {
            if (candidate.isApproximatelyEqual(target)) {
                return true;
            }
        }
        return false;
    }

    private BufferedImage loadCandidateImage(String dataUrl) {
        if (!StringUtils.hasText(dataUrl)) {
            return null;
        }
        int comma = dataUrl.indexOf(',');
        if (comma < 0) {
            return null;
        }
        String base64 = dataUrl.substring(comma + 1);
        try (ByteArrayInputStream bais = new ByteArrayInputStream(Base64.getDecoder().decode(base64))) {
            return ImageIO.read(bais);
        } catch (Exception ex) {
            LOG.debug("Failed to decode candidate image from inspection payload", ex);
            return null;
        }
    }

    private ArrayNode boxesToArrayNode(List<BoxCoord> boxes) {
        ArrayNode array = mapper.createArrayNode();
        for (BoxCoord box : boxes) {
            ArrayNode coords = mapper.createArrayNode();
            coords.add(box.x);
            coords.add(box.y);
            coords.add(box.width);
            coords.add(box.height);
            array.add(coords);
        }
        return array;
    }

    private String buildDefaultNotes(int addedCount, int removedCount, int aiBoxCount, int userBoxCount) {
        return String.format(Locale.ROOT,
                "added=%d removed=%d ai=%d user=%d",
                addedCount,
                removedCount,
                aiBoxCount,
                userBoxCount);
    }

    private JsonNode invokePythonTuner(File candidateFile, File payloadFile) {
        try {
            File scriptFile = resolveScriptFile(tuningScriptPath);
            List<String> cmd = new ArrayList<>();
            cmd.add(pythonCommand);
            cmd.add(scriptFile.getAbsolutePath());
            cmd.add(candidateFile.getAbsolutePath());
            cmd.add(payloadFile.getAbsolutePath());

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(new File(System.getProperty("user.dir")));
            pb.redirectErrorStream(true);

            Process process = pb.start();
            StringBuilder output = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    output.append(line).append('\n');
                }
            }
            int code = process.waitFor();
            if (code != 0) {
                LOG.warn("Python tuning script exited with code {}: {}", code, output);
                return null;
            }
            if (output.length() == 0) {
                return null;
            }
            return mapper.readTree(output.toString());
        } catch (Exception ex) {
            LOG.warn("Failed to invoke python tuning script", ex);
            return null;
        }
    }

    private void applyParameterUpdates(JsonNode updatesNode) {
        if (updatesNode == null || !updatesNode.isObject()) {
            return;
        }
        updatesNode.fields().forEachRemaining(entry -> {
            AiParameterKey key = resolveParameterKey(entry.getKey());
            JsonNode value = entry.getValue();
            if (key != null && value.isNumber()) {
                double delta = value.asDouble();
                if (Math.abs(delta) > 0.0) {
                    parameterService.adjustValue(key, delta);
                }
            }
        });
    }

    private File resolveScriptFile(String configuredPath) {
        File script = new File(configuredPath);
        if (!script.isAbsolute()) {
            script = new File(System.getProperty("user.dir"), configuredPath);
        }
        return script;
    }

    private AiParameterKey resolveParameterKey(String key) {
        for (AiParameterKey candidate : AiParameterKey.values()) {
            if (candidate.getKey().equalsIgnoreCase(key)) {
                return candidate;
            }
        }
        return null;
    }

    private record BoxCoord(double x, double y, double width, double height) {
        boolean isApproximatelyEqual(BoxCoord other) {
            return Math.abs(this.x - other.x) <= BOX_TOLERANCE
                    && Math.abs(this.y - other.y) <= BOX_TOLERANCE
                    && Math.abs(this.width - other.width) <= BOX_TOLERANCE
                    && Math.abs(this.height - other.height) <= BOX_TOLERANCE;
        }
    }
}
