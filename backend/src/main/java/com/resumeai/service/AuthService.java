package com.resumeai.service;

import com.resumeai.config.JwtUtil;
import com.resumeai.model.User;
import com.resumeai.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * AuthService — handles user registration and login logic
 *
 * FLOW:
 *  Register: validate → hash password → save to DB → return JWT token
 *  Login:    find user → compare password → return JWT token
 */
@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * REGISTER a new user
     *
     * @param name     - Full name
     * @param email    - Email address (must be unique)
     * @param password - Plain text password (will be hashed)
     * @param role     - "CANDIDATE" or "INTERVIEWER"
     * @return Map with success status and user data
     */
    public Map<String, Object> register(String name, String email, String password, String role) {
        Map<String, Object> response = new HashMap<>();

        // Check if email already taken
        if (userRepository.existsByEmail(email)) {
            response.put("success", false);
            response.put("message", "Email is already registered. Please login instead.");
            return response;
        }

        // Create new user
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password)); // BCrypt hash
        user.setRole(User.Role.valueOf(role.toUpperCase())); // Convert "CANDIDATE" string to enum

        // Save to database
        User saved = userRepository.save(user);

        // Generate JWT token
        String token = jwtUtil.generateToken(saved.getEmail(), saved.getId(), saved.getRole().name());

        response.put("success", true);
        response.put("message", "Registration successful!");
        response.put("userId", saved.getId());
        response.put("name", saved.getName());
        response.put("email", saved.getEmail());
        response.put("role", saved.getRole().name());
        response.put("token", token);
        return response;
    }

    /**
     * LOGIN an existing user
     *
     * @param email    - User's email
     * @param password - Plain text password (compared with BCrypt hash in DB)
     * @return Map with success status and user data + JWT token
     */
    public Map<String, Object> login(String email, String password) {
        Map<String, Object> response = new HashMap<>();

        // Find user by email
        User user = userRepository.findByEmail(email).orElse(null);

        // User not found
        if (user == null) {
            response.put("success", false);
            response.put("message", "No account found with this email.");
            return response;
        }

        // Check password — BCrypt compares the raw password with the stored hash
        if (!passwordEncoder.matches(password, user.getPassword())) {
            response.put("success", false);
            response.put("message", "Incorrect password. Please try again.");
            return response;
        }

        // Generate JWT token
        String token = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getRole().name());

        response.put("success", true);
        response.put("message", "Login successful!");
        response.put("userId", user.getId());
        response.put("name", user.getName());
        response.put("email", user.getEmail());
        response.put("role", user.getRole().name());
        response.put("token", token);
        return response;
    }
}
