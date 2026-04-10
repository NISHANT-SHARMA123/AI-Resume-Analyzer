package com.resumeai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ╔══════════════════════════════════════════════════╗
 *  ResumeAI — AI-Powered Resume Analyzer
 *  Main Spring Boot Application Entry Point
 * ╚══════════════════════════════════════════════════╝
 *
 * HOW TO RUN:
 *   mvn spring-boot:run
 *
 * OR build JAR and run:
 *   mvn clean package
 *   java -jar target/resumeai-backend-1.0.0.jar
 */
@SpringBootApplication
public class ResumeAiApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResumeAiApplication.class, args);
    }
}
