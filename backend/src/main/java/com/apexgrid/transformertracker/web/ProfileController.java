package com.apexgrid.transformertracker.web;

import com.apexgrid.transformertracker.model.User;
import com.apexgrid.transformertracker.repo.UserRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private final UserRepo userRepo;
    private final PasswordEncoder encoder;

    public ProfileController(UserRepo userRepo, PasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.encoder = encoder;
    }

    @GetMapping
    public ResponseEntity<?> getProfile(@RequestParam String username) {
        var userOpt = userRepo.findByUsername(username);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        var user = userOpt.get();
        return ResponseEntity.ok(Map.of(
            "username", user.getUsername(),
            "image", user.getImage() != null ? user.getImage() : ""
        ));
    }

    @PostMapping("/image")
    public ResponseEntity<?> updateImage(@RequestBody Map<String, String> body) {
        String username = body.getOrDefault("username", "");
        String image = body.getOrDefault("image", "");
        
        var userOpt = userRepo.findByUsername(username);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        var user = userOpt.get();
        user.setImage(image.isEmpty() ? null : image);
        userRepo.save(user);
        
        return ResponseEntity.ok(Map.of("message", "Profile image updated"));
    }

    @PostMapping("/password")
    public ResponseEntity<?> updatePassword(@RequestBody Map<String, String> body) {
        String username = body.getOrDefault("username", "");
        String currentPassword = body.getOrDefault("currentPassword", "");
        String newPassword = body.getOrDefault("newPassword", "");
        
        if (newPassword.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "New password cannot be empty"));
        }
        
        var userOpt = userRepo.findByUsername(username);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        var user = userOpt.get();
        if (!encoder.matches(currentPassword, user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Current password is incorrect"));
        }
        
        user.setPasswordHash(encoder.encode(newPassword));
        userRepo.save(user);
        
        return ResponseEntity.ok(Map.of("message", "Password updated"));
    }
}
