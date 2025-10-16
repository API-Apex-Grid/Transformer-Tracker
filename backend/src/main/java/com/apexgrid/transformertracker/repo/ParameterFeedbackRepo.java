package com.apexgrid.transformertracker.repo;

import com.apexgrid.transformertracker.model.ParameterFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ParameterFeedbackRepo extends JpaRepository<ParameterFeedback, UUID> {
}
