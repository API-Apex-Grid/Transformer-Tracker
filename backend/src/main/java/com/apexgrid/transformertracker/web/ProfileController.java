package com.apexgrid.transformertracker.web;

import com.apexgrid.transformertracker.model.User;
import com.apexgrid.transformertracker.repo.UserRepo;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        var userOpt = userRepo.findByUsername(principal.getUsername());
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
    public ResponseEntity<?> updateImage(@AuthenticationPrincipal UserDetails principal,
                                         @RequestBody Map<String, String> body) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        String image = body.getOrDefault("image", "");
        
        var userOpt = userRepo.findByUsername(principal.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        var user = userOpt.get();
        user.setImage(image.isEmpty() ? null : image);
        userRepo.save(user);
        
        return ResponseEntity.ok(Map.of("message", "Profile image updated"));
    }

    @PostMapping("/password")
    public ResponseEntity<?> updatePassword(@AuthenticationPrincipal UserDetails principal,
                                            @RequestBody Map<String, String> body) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        String currentPassword = body.getOrDefault("currentPassword", "");
        String newPassword = body.getOrDefault("newPassword", "");
        
        if (newPassword.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "New password cannot be empty"));
        }
        
        var userOpt = userRepo.findByUsername(principal.getUsername());
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
