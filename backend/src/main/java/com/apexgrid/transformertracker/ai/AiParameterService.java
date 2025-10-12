package com.apexgrid.transformertracker.ai;

import com.apexgrid.transformertracker.model.ModelParameter;
import com.apexgrid.transformertracker.repo.ModelParameterRepo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AiParameterService {
    private final ModelParameterRepo modelParameterRepo;
    private final Map<AiParameterKey, Double> cache = new ConcurrentHashMap<>();

    public AiParameterService(ModelParameterRepo modelParameterRepo) {
        this.modelParameterRepo = modelParameterRepo;
        initializeCache();
    }

    private void initializeCache() {
        for (AiParameterKey key : AiParameterKey.values()) {
            double value = modelParameterRepo.findById(key.getKey())
                    .map(ModelParameter::getValue)
                    .orElseGet(() -> {
                        ModelParameter mp = new ModelParameter(key.getKey(), key.getDefaultValue());
                        modelParameterRepo.save(mp);
                        return mp.getValue();
                    });
            cache.put(key, key.clamp(value));
        }
    }

    public Map<String, Double> getAllParameters() {
        Map<String, Double> snapshot = new java.util.LinkedHashMap<>();
        for (AiParameterKey key : AiParameterKey.values()) {
            snapshot.put(key.getKey(), getValue(key));
        }
        return Collections.unmodifiableMap(snapshot);
    }

    public double getValue(AiParameterKey key) {
        return cache.getOrDefault(key, key.getDefaultValue());
    }

    public synchronized double setValue(AiParameterKey key, double value) {
        double clamped = key.clamp(value);
        ModelParameter entity = modelParameterRepo.findById(key.getKey())
                .orElseGet(() -> new ModelParameter(key.getKey(), clamped));
        entity.setValue(clamped);
        entity.setUpdatedAt(Instant.now());
        modelParameterRepo.save(entity);
        cache.put(key, clamped);
        return clamped;
    }

    public synchronized double adjustValue(AiParameterKey key, double delta) {
        double current = getValue(key);
        double updated = key.clamp(current + delta);
        return setValue(key, updated);
    }

    public ObjectNode buildConfigNode(ObjectMapper mapper) {
        Assert.notNull(mapper, "ObjectMapper is required");
        ObjectNode node = mapper.createObjectNode();
        for (AiParameterKey key : AiParameterKey.values()) {
            double value = getValue(key);
            if (key.isInteger()) {
                node.put(key.getKey(), (int) Math.rint(value));
            } else {
                node.put(key.getKey(), value);
            }
        }
        return node;
    }
}
