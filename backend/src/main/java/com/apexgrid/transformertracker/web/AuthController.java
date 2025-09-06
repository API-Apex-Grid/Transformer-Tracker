package com.apexgrid.transformertracker.web;

import com.apexgrid.transformertracker.model.User;
import com.apexgrid.transformertracker.repo.UserRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final UserRepo userRepo;
    private final PasswordEncoder encoder;

    public AuthController(UserRepo userRepo, PasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.encoder = encoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.getOrDefault("username", "");
        String password = body.getOrDefault("password", "");
        var userOpt = userRepo.findByUsername(username);
        if (userOpt.isEmpty()) {
            // auto-create user1..5 on first login behavior (dev)
            if (username.matches("user[1-5]") && password.equals(username)) {
                User u = new User();
                u.setUsername(username);
                u.setPasswordHash(encoder.encode(password));
                userRepo.save(u);
                return ResponseEntity.ok(Map.of("token", "dev-token"));
            }
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }
        var user = userOpt.get();
        if (!encoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }
        return ResponseEntity.ok(Map.of("token", "dev-token"));
    }
}
