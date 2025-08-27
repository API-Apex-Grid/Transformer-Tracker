package com.apexgrid.transformertracker.repo;

import com.apexgrid.transformertracker.model.Transformer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TransformerRepo extends JpaRepository<Transformer, String> {
    Optional<Transformer> findByTransformerNumber(String transformerNumber);
    List<Transformer> findByFavouriteTrue();
}
