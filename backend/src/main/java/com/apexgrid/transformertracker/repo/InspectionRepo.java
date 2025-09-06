package com.apexgrid.transformertracker.repo;

import com.apexgrid.transformertracker.model.Inspection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InspectionRepo extends JpaRepository<Inspection, String> {
    List<Inspection> findByFavouriteTrue();
}
