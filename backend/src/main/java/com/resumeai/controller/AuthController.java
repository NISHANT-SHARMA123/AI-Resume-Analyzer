package com.resumeai.controller;

import com.resumeai.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AuthController — REST endpoints for user registration and login
 *
 * BASE URL: /api/auth
 *
 * ENDPOINTS:
 *   POST /api/auth/register  → Create new account
 *   POST /api/auth/login     → Login to existing account
 *
 * These endpoints are PUBLIC — no JWT token required
 * (configured in SecurityConfig.java)
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    /**
     * POST /api/auth/register
     *
     * Request Body (JSON):
     * {
     *   "name": "John Doe",
     *   "email": "john@example.com",
     *   "password": "myPassword123",
     *   "role": "CANDIDATE"
     * }
     *
     * Response (JSON):
     * {
     *   "success": true,
     *   "userId": 1,
     *   "name": "John Doe",
     *   "email": "john@example.com",
     *   "role": "CANDIDATE",
     *   "token": "eyJhbGci..."
     * }
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body) {
        Map<String, Object> result = authService.register(
            body.get("name"),
            body.get("email"),
            body.get("password"),
            body.get("role")
        );
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/auth/login
     *
     * Request Body (JSON):
     * {
     *   "email": "john@example.com",
     *   "password": "myPassword123"
     * }
     *
     * Response: same as /register response
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        Map<String, Object> result = authService.login(
            body.get("email"),
            body.get("password")
        );
        return ResponseEntity.ok(result);
    }
}
