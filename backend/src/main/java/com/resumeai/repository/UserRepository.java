package com.resumeai.repository;

import com.resumeai.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

/**
 * UserRepository
 * Spring Data JPA automatically generates all basic CRUD operations.
 * We just declare the method signatures and Spring handles the SQL.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // Find a user by their email address (used during login)
    Optional<User> findByEmail(String email);

    // Check if an email already exists (used during registration)
    boolean existsByEmail(String email);
}
