package com.apexgrid.transformertracker.ai;

public enum AiParameterKey {
    H_BINS("h_bins", 30d, 6d, 120d, Type.INTEGER, false),
    S_BINS("s_bins", 32d, 6d, 120d, Type.INTEGER, false),
    SAMPLE_EVERY("sample_every", 10d, 1d, 50d, Type.INTEGER, false),
    WARM_HUE_LOW("warm_hue_low", 0.17d, 0.0d, 0.5d, Type.DOUBLE, false),
    WARM_HUE_HIGH("warm_hue_high", 0.95d, 0.5d, 1.0d, Type.DOUBLE, false),
    WARM_SAT_THRESHOLD("warm_sat_threshold", 0.30d, 0.05d, 1.0d, Type.DOUBLE, true),
    WARM_VAL_THRESHOLD("warm_val_threshold", 0.40d, 0.05d, 1.0d, Type.DOUBLE, true),
    CONTRAST_THRESHOLD("contrast_threshold", 0.15d, 0.01d, 1.0d, Type.DOUBLE, true),
    MIN_AREA_RATIO("min_area_ratio", 0.001d, 0.0d, 0.05d, Type.DOUBLE, true),
    MIN_AREA_PIXELS("min_area_pixels", 32d, 4d, 6400d, Type.INTEGER, true),
    HIST_DISTANCE_SCALE("hist_distance_scale", 0.5d, 0.05d, 10.0d, Type.DOUBLE, false),
    WARM_FRACTION_SCALE("warm_fraction_scale", 2.0d, 0.1d, 10.0d, Type.DOUBLE, false),
    DV95_SCALE("dv95_scale", 1.0d, 0.1d, 10.0d, Type.DOUBLE, false),
    DV95_PERCENTILE("dv95_percentile", 0.95d, 0.5d, 0.999d, Type.DOUBLE, false),
    LOOSE_AREA_THRESHOLD("loose_area_threshold", 0.10d, 0.01d, 0.6d, Type.DOUBLE, true),
    LARGE_AREA_THRESHOLD("large_area_threshold", 0.30d, 0.05d, 0.9d, Type.DOUBLE, true),
    CENTER_OVERLAP_THRESHOLD("center_overlap_threshold", 0.40d, 0.05d, 1.0d, Type.DOUBLE, true),
    RECTANGULAR_ASPECT_THRESHOLD("rectangular_aspect_threshold", 2.0d, 1.1d, 6.0d, Type.DOUBLE, true),
    SEVERITY_LOWER_DELTA("severity_lower_delta", 0.15d, 0.0d, 1.0d, Type.DOUBLE, false),
    SEVERITY_UPPER_DELTA("severity_upper_delta", 0.50d, 0.05d, 2.0d, Type.DOUBLE, false),
    SEVERITY_FLOOR("severity_floor", 0.05d, 0.0d, 0.5d, Type.DOUBLE, false),
    CROP_MARGIN_PCT("crop_margin_pct", 0.05d, 0.0d, 0.2d, Type.DOUBLE, false);

    private final String key;
    private final double defaultValue;
    private final double minValue;
    private final double maxValue;
    private final Type type;
    private final boolean optimizable;

    AiParameterKey(String key, double defaultValue, double minValue, double maxValue, Type type, boolean optimizable) {
        this.key = key;
        this.defaultValue = defaultValue;
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.type = type;
        this.optimizable = optimizable;
    }

    public String getKey() {
        return key;
    }

    public double getDefaultValue() {
        return defaultValue;
    }

    public double clamp(double value) {
        double clamped = Math.max(minValue, Math.min(maxValue, value));
        if (type == Type.INTEGER) {
            clamped = Math.rint(clamped);
        }
        return clamped;
    }

    public boolean isInteger() {
        return type == Type.INTEGER;
    }

    public boolean isOptimizable() {
        return optimizable;
    }

    public enum Type {
        INTEGER,
        DOUBLE
    }
}
