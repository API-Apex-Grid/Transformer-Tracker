package com.apexgrid.transformertracker.ai;

import com.apexgrid.transformertracker.model.Inspection;
import com.apexgrid.transformertracker.model.ParameterFeedback;
import com.apexgrid.transformertracker.repo.ParameterFeedbackRepo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Locale;

@Service
public class ParameterTuningService {
    private static final Logger LOG = LoggerFactory.getLogger(ParameterTuningService.class);

    private final ObjectMapper mapper = new ObjectMapper();
    private final ParameterFeedbackRepo feedbackRepo;
    private final AiParameterService parameterService;

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
            if (prevBoxesNode == null || !prevBoxesNode.isArray()) {
                return;
            }
            if (finalBoxesNode == null || !finalBoxesNode.isArray()) {
                return;
            }
            if (prevBoxesNode.equals(finalBoxesNode)) {
                return;
            }
            if (!containsAiAnnotation(previousAnnotated)) {
                return;
            }

            int aiBoxCount = prevBoxesNode.size();
            int userBoxCount = finalBoxesNode.size();
            int diff = aiBoxCount - userBoxCount;

            double avgAiArea = averageArea(prevBoxesNode);
            double avgUserArea = averageArea(finalBoxesNode);

            String notes = buildNotes(diff, avgAiArea, avgUserArea);
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

            adaptParameters(diff, avgAiArea, avgUserArea);

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

    private double averageArea(JsonNode boxesNode) {
        if (boxesNode == null || !boxesNode.isArray() || boxesNode.isEmpty()) {
            return 0.0;
        }
        double sum = 0.0;
        int count = 0;
        for (JsonNode box : boxesNode) {
            if (box != null && box.isArray() && box.size() >= 4) {
                double w = box.get(2).asDouble(0.0);
                double h = box.get(3).asDouble(0.0);
                double area = Math.max(0.0, w) * Math.max(0.0, h);
                if (area > 0.0) {
                    sum += area;
                    count++;
                }
            }
        }
        if (count == 0) {
            return 0.0;
        }
        return sum / count;
    }

    private String buildNotes(int diff, double avgAiArea, double avgUserArea) {
        return String.format(Locale.ROOT, "diff=%d avg_ai_area=%.2f avg_user_area=%.2f", diff, avgAiArea, avgUserArea);
    }

    private void adaptParameters(int diff, double avgAiArea, double avgUserArea) {
        if (diff != 0) {
            double magnitude = Math.min(3.0, Math.max(1.0, Math.abs(diff)));
            double direction = diff > 0 ? 1.0 : -1.0;
            parameterService.adjustValue(AiParameterKey.WARM_SAT_THRESHOLD, direction * 0.015 * magnitude);
            parameterService.adjustValue(AiParameterKey.WARM_VAL_THRESHOLD, direction * 0.015 * magnitude);
            parameterService.adjustValue(AiParameterKey.CONTRAST_THRESHOLD, direction * 0.0075 * magnitude);
        } else if (avgAiArea > 0.0 && avgUserArea > 0.0) {
            double ratio = avgUserArea / Math.max(1e-6, avgAiArea);
            double logMagnitude = Math.abs(Math.log(ratio));
            if (ratio < 0.9) {
                double scale = Math.min(2.0, 1.0 + logMagnitude);
                parameterService.adjustValue(AiParameterKey.MIN_AREA_RATIO, -0.0005 * scale);
                parameterService.adjustValue(AiParameterKey.MIN_AREA_PIXELS, -2.0 * scale);
                parameterService.adjustValue(AiParameterKey.LOOSE_AREA_THRESHOLD, -0.01 * scale);
                parameterService.adjustValue(AiParameterKey.LARGE_AREA_THRESHOLD, -0.01 * scale);
            } else if (ratio > 1.1) {
                double scale = Math.min(2.0, 1.0 + logMagnitude);
                parameterService.adjustValue(AiParameterKey.MIN_AREA_RATIO, 0.0005 * scale);
                parameterService.adjustValue(AiParameterKey.MIN_AREA_PIXELS, 2.0 * scale);
                parameterService.adjustValue(AiParameterKey.LOOSE_AREA_THRESHOLD, 0.01 * scale);
                parameterService.adjustValue(AiParameterKey.LARGE_AREA_THRESHOLD, 0.01 * scale);
            }
        }
    }
}
