package com.resumeai.service;

import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.*;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.resumeai.model.ResumeAnalysis;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;

/**
 * ReportGeneratorService
 *
 * Generates a professional PDF analysis report using iText 7.
 *
 * Report sections:
 *   1. Header with branding
 *   2. Resume & Job Description info
 *   3. Match Score with visual bar
 *   4. Missing Keywords
 *   5. AI Feedback Points
 *   6. Improvement Suggestions
 *   7. Skills Identified (keywords matched)
 *   8. Footer with timestamp
 */
@Service
public class ReportGeneratorService {

    // ── Brand Colors ─────────────────────────────────────
    private static final DeviceRgb COLOR_PRIMARY   = new DeviceRgb(0,   110, 184); // #006EB8
    private static final DeviceRgb COLOR_ACCENT    = new DeviceRgb(16,  185, 129); // #10b981 green
    private static final DeviceRgb COLOR_DANGER    = new DeviceRgb(239,  68,  68); // #ef4444 red
    private static final DeviceRgb COLOR_PURPLE    = new DeviceRgb(168,  85, 247); // #a855f7
    private static final DeviceRgb COLOR_DARK_BG   = new DeviceRgb( 15,  23,  42); // #0f172a
    private static final DeviceRgb COLOR_LIGHT_GRAY= new DeviceRgb(248, 250, 252); // #f8fafc
    private static final DeviceRgb COLOR_TEXT      = new DeviceRgb( 30,  41,  59); // #1e293b
    private static final DeviceRgb COLOR_MUTED     = new DeviceRgb(100, 116, 139); // #64748b

    /**
     * Generates a PDF report as a byte array.
     *
     * @param analysis  The saved ResumeAnalysis entity from the database
     * @return          Raw PDF bytes to stream back to the frontend
     */
    public byte[] generateAnalysisReport(ResumeAnalysis analysis) throws IOException {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdfDoc = new PdfDocument(writer);
        Document document = new Document(pdfDoc, PageSize.A4);
        document.setMargins(0, 0, 36, 0); // Header uses full width; sides handled per element

        PdfFont bold    = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
        PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
        PdfFont mono    = PdfFontFactory.createFont(StandardFonts.COURIER);

        // ── 1. HEADER BAND ────────────────────────────────────────
        addHeader(document, bold, regular, analysis);

        // ── 2. BODY CONTENT ───────────────────────────────────────
        // Add left/right margins to body sections
        document.setMargins(0, 48, 36, 48);

        addSpacer(document, 20);
        addMetaSection(document, bold, regular, mono, analysis);
        addSpacer(document, 20);
        addScoreSection(document, bold, regular, analysis);
        addSpacer(document, 24);
        addKeywordsSection(document, bold, regular, analysis);
        addSpacer(document, 20);
        addFeedbackSection(document, bold, regular, analysis);
        addSpacer(document, 20);
        addSuggestionsSection(document, bold, regular, analysis);
        addSpacer(document, 20);
        addSkillsSection(document, bold, regular, analysis);
        addSpacer(document, 28);
        addFooter(document, regular, analysis);

        document.close();
        return baos.toByteArray();
    }

    // ═══════════════════════════════════════════
    //  SECTION BUILDERS
    // ═══════════════════════════════════════════

    private void addHeader(Document doc, PdfFont bold, PdfFont regular, ResumeAnalysis analysis) {
        // Dark header band
        Table headerTable = new Table(UnitValue.createPercentArray(new float[]{1}))
                .useAllAvailableWidth()
                .setMargins(0, 0, 0, 0);

        Cell headerCell = new Cell()
                .setBackgroundColor(COLOR_DARK_BG)
                .setPaddings(32, 48, 28, 48)
                .setBorder(null);

        // ResumeAI branding
        Paragraph brand = new Paragraph("ResumeAI")
                .setFont(bold)
                .setFontSize(22)
                .setFontColor(new DeviceRgb(0, 245, 255)) // neon cyan
                .setMarginBottom(4);
        headerCell.add(brand);

        // Report title
        Paragraph title = new Paragraph("Resume Analysis Report")
                .setFont(regular)
                .setFontSize(13)
                .setFontColor(ColorConstants.WHITE)
                .setMarginBottom(16);
        headerCell.add(title);

        // Divider line (cyan)
        Table divider = new Table(UnitValue.createPercentArray(new float[]{1}))
                .useAllAvailableWidth()
                .setMarginBottom(16);
        Cell divCell = new Cell()
                .setHeight(2)
                .setBackgroundColor(new DeviceRgb(0, 245, 255))
                .setBorder(null);
        divider.addCell(divCell);
        headerCell.add(divider);

        // Candidate name and file
        String resumeName = analysis.getResume() != null ? analysis.getResume().getFileName() : "Resume";
        Paragraph candidate = new Paragraph("📄  " + resumeName)
                .setFont(bold)
                .setFontSize(10)
                .setFontColor(new DeviceRgb(148, 163, 184))
                .setMarginBottom(0);
        headerCell.add(candidate);

        headerTable.addCell(headerCell);
        doc.add(headerTable);
    }

    private void addMetaSection(Document doc, PdfFont bold, PdfFont regular, PdfFont mono,
                                 ResumeAnalysis analysis) {
        addSectionTitle(doc, bold, "📋  Report Overview", COLOR_PRIMARY);

        Table meta = new Table(UnitValue.createPercentArray(new float[]{1, 1}))
                .useAllAvailableWidth()
                .setMarginTop(10);

        // Resume name cell
        String fileName = analysis.getResume() != null ? analysis.getResume().getFileName() : "N/A";
        meta.addCell(metaCell("Resume File", fileName, bold, regular));

        // Analysis date cell
        String date = analysis.getAnalyzedAt() != null
                ? analysis.getAnalyzedAt().format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"))
                : "N/A";
        meta.addCell(metaCell("Analyzed At", date, bold, regular));

        doc.add(meta);

        // Job Description box (truncated preview)
        addSpacer(doc, 12);
        addSectionTitle(doc, bold, "💼  Job Description Used", COLOR_MUTED);
        addSpacer(doc, 6);

        String jd = analysis.getJobDescription() != null ? analysis.getJobDescription() : "";
        String jdPreview = jd.length() > 500 ? jd.substring(0, 497) + "..." : jd;

        Paragraph jdPara = new Paragraph(jdPreview)
                .setFont(regular)
                .setFontSize(9)
                .setFontColor(COLOR_TEXT)
                .setPaddings(14, 16, 14, 16)
                .setBackgroundColor(COLOR_LIGHT_GRAY)
                .setBorderLeft(new SolidBorder(COLOR_PRIMARY, 3))
                .setMarginTop(4);
        doc.add(jdPara);
    }

    private void addScoreSection(Document doc, PdfFont bold, PdfFont regular, ResumeAnalysis analysis) {
        addSectionTitle(doc, bold, "🎯  Match Score", COLOR_PRIMARY);
        addSpacer(doc, 8);

        int score = analysis.getMatchScore() != null ? (int) Math.round(analysis.getMatchScore()) : 0;
        DeviceRgb scoreColor = getScoreColor(score);
        String scoreLabel    = getScoreLabel(score);

        // Score display table
        Table scoreTable = new Table(UnitValue.createPercentArray(new float[]{0.25f, 0.75f}))
                .useAllAvailableWidth();

        // Score circle (simulated with a box)
        Cell scoreBox = new Cell()
                .setBackgroundColor(scoreColor)
                .setPaddings(20, 10, 20, 10)
                .setTextAlignment(TextAlignment.CENTER)
                .setBorder(null);
        scoreBox.add(new Paragraph(score + "%")
                .setFont(bold).setFontSize(28).setFontColor(ColorConstants.WHITE).setMarginBottom(2));
        scoreBox.add(new Paragraph(scoreLabel)
                .setFont(regular).setFontSize(8).setFontColor(ColorConstants.WHITE));
        scoreTable.addCell(scoreBox);

        // Progress bar + description
        Cell descCell = new Cell()
                .setPaddings(16, 20, 16, 20)
                .setBackgroundColor(COLOR_LIGHT_GRAY)
                .setBorder(null);

        descCell.add(new Paragraph("Resume Match Score")
                .setFont(bold).setFontSize(12).setFontColor(COLOR_TEXT).setMarginBottom(6));

        String description = score >= 80
                ? "Excellent! Your resume is a strong match for this position."
                : score >= 60
                ? "Good match. A few improvements could strengthen your application."
                : score >= 40
                ? "Fair match. Consider tailoring your resume more to the job requirements."
                : "Needs work. Significant gaps exist between your resume and the job requirements.";
        descCell.add(new Paragraph(description)
                .setFont(regular).setFontSize(9.5f).setFontColor(COLOR_MUTED).setMarginBottom(12));

        // Progress bar (built from a table)
        Table bar = new Table(UnitValue.createPercentArray(new float[]{score, Math.max(1, 100 - score)}))
                .useAllAvailableWidth();
        bar.addCell(new Cell().setHeight(8).setBackgroundColor(scoreColor).setBorder(null));
        bar.addCell(new Cell().setHeight(8).setBackgroundColor(new DeviceRgb(226, 232, 240)).setBorder(null));
        descCell.add(bar);

        scoreTable.addCell(descCell);
        doc.add(scoreTable);
    }

    private void addKeywordsSection(Document doc, PdfFont bold, PdfFont regular, ResumeAnalysis analysis) {
        // Missing keywords
        addSectionTitle(doc, bold, "❌  Missing Keywords", COLOR_DANGER);
        addSpacer(doc, 6);

        String missing = analysis.getMissingKeywords();
        if (missing != null && !missing.isBlank()) {
            String[] keywords = missing.split(",");
            // Render as inline tags using a single paragraph with spans
            Paragraph tagLine = new Paragraph();
            for (String kw : keywords) {
                String trimmed = kw.trim();
                if (!trimmed.isEmpty()) {
                    tagLine.add(new Text("  " + trimmed + "  ")
                            .setFont(regular).setFontSize(9)
                            .setFontColor(COLOR_DANGER)
                            .setBackgroundColor(new DeviceRgb(254, 226, 226)));
                    tagLine.add(new Text("  ").setFont(regular).setFontSize(9));
                }
            }
            doc.add(tagLine);
        } else {
            doc.add(new Paragraph("No missing keywords identified — great coverage!")
                    .setFont(regular).setFontSize(9.5f).setFontColor(COLOR_ACCENT));
        }
    }

    private void addFeedbackSection(Document doc, PdfFont bold, PdfFont regular, ResumeAnalysis analysis) {
        addSectionTitle(doc, bold, "🤖  AI Feedback", COLOR_PRIMARY);
        addSpacer(doc, 6);

        String feedback = analysis.getFeedbackPoints();
        if (feedback != null && !feedback.isBlank()) {
            for (String line : feedback.split("\n")) {
                String clean = line.trim().replaceAll("^[-•*✅⚡⚠️❌💡]\\s*", "");
                if (!clean.isEmpty()) {
                    addBulletPoint(doc, regular, clean, COLOR_PRIMARY);
                }
            }
        } else {
            doc.add(noDataParagraph(regular));
        }
    }

    private void addSuggestionsSection(Document doc, PdfFont bold, PdfFont regular, ResumeAnalysis analysis) {
        addSectionTitle(doc, bold, "💡  Improvement Suggestions", COLOR_PURPLE);
        addSpacer(doc, 6);

        String suggestions = analysis.getImprovementSuggestions();
        if (suggestions != null && !suggestions.isBlank()) {
            int idx = 1;
            for (String line : suggestions.split("\n")) {
                String clean = line.trim().replaceAll("^[\\d.\\-•*]+\\s*", "");
                if (!clean.isEmpty()) {
                    Paragraph bullet = new Paragraph()
                            .add(new Text(idx + ".  ").setFont(bold).setFontSize(9.5f).setFontColor(COLOR_PURPLE))
                            .add(new Text(clean).setFont(regular).setFontSize(9.5f).setFontColor(COLOR_TEXT))
                            .setMarginBottom(6)
                            .setMarginLeft(8);
                    doc.add(bullet);
                    idx++;
                }
            }
        } else {
            doc.add(noDataParagraph(regular));
        }
    }

    private void addSkillsSection(Document doc, PdfFont bold, PdfFont regular, ResumeAnalysis analysis) {
        addSectionTitle(doc, bold, "✅  Skills Identified", COLOR_ACCENT);
        addSpacer(doc, 6);

        String matched = analysis.getKeywordsMatched();
        if (matched != null && !matched.isBlank()) {
            String[] skills = matched.split(",");
            Paragraph tagLine = new Paragraph();
            for (String skill : skills) {
                String trimmed = skill.trim();
                if (!trimmed.isEmpty()) {
                    tagLine.add(new Text("  " + trimmed + "  ")
                            .setFont(regular).setFontSize(9)
                            .setFontColor(COLOR_ACCENT)
                            .setBackgroundColor(new DeviceRgb(209, 250, 229)));
                    tagLine.add(new Text("  ").setFont(regular).setFontSize(9));
                }
            }
            doc.add(tagLine);
        } else {
            doc.add(noDataParagraph(regular));
        }
    }

    private void addFooter(Document doc, PdfFont regular, ResumeAnalysis analysis) {
        Table footerTable = new Table(UnitValue.createPercentArray(new float[]{1}))
                .useAllAvailableWidth()
                .setMargins(0, -48, 0, -48); // bleed to edge

        Cell footerCell = new Cell()
                .setBackgroundColor(COLOR_LIGHT_GRAY)
                .setPaddings(16, 48, 16, 48)
                .setBorderTop(new SolidBorder(new DeviceRgb(226, 232, 240), 1))
                .setBorder(null)
                .setBorderTop(new SolidBorder(new DeviceRgb(203, 213, 225), 1));

        String generated = "Generated by ResumeAI  •  " +
                (analysis.getAnalyzedAt() != null
                        ? analysis.getAnalyzedAt().format(DateTimeFormatter.ofPattern("MMMM dd, yyyy"))
                        : "");

        footerCell.add(new Paragraph(generated)
                .setFont(regular).setFontSize(8).setFontColor(COLOR_MUTED)
                .setTextAlignment(TextAlignment.CENTER));

        footerCell.add(new Paragraph("This report is AI-generated for guidance purposes. Always review with a career professional.")
                .setFont(regular).setFontSize(7.5f).setFontColor(new DeviceRgb(148, 163, 184))
                .setTextAlignment(TextAlignment.CENTER).setMarginTop(4));

        footerTable.addCell(footerCell);
        doc.add(footerTable);
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    private void addSectionTitle(Document doc, PdfFont bold, String title, DeviceRgb color) {
        Paragraph heading = new Paragraph(title)
                .setFont(bold)
                .setFontSize(11.5f)
                .setFontColor(color)
                .setMarginBottom(2)
                .setPaddingBottom(6)
                .setBorderBottom(new SolidBorder(new DeviceRgb(226, 232, 240), 1));
        doc.add(heading);
    }

    private void addBulletPoint(Document doc, PdfFont regular, String text, DeviceRgb bulletColor) {
        Paragraph bullet = new Paragraph()
                .add(new Text("›  ").setFont(regular).setFontSize(12).setFontColor(bulletColor))
                .add(new Text(text).setFont(regular).setFontSize(9.5f).setFontColor(COLOR_TEXT))
                .setMarginBottom(6)
                .setMarginLeft(8);
        doc.add(bullet);
    }

    private Cell metaCell(String label, String value, PdfFont bold, PdfFont regular) {
        Cell cell = new Cell()
                .setPaddings(12, 14, 12, 14)
                .setBackgroundColor(COLOR_LIGHT_GRAY)
                .setBorder(null)
                .setMargin(4);
        cell.add(new Paragraph(label)
                .setFont(bold).setFontSize(8).setFontColor(COLOR_MUTED).setMarginBottom(3));
        cell.add(new Paragraph(value)
                .setFont(regular).setFontSize(10).setFontColor(COLOR_TEXT));
        return cell;
    }

    private Paragraph noDataParagraph(PdfFont regular) {
        return new Paragraph("No data available")
                .setFont(regular).setFontSize(9).setFontColor(COLOR_MUTED).setItalic();
    }

    private void addSpacer(Document doc, float height) {
        doc.add(new Paragraph(" ").setFontSize(1).setMarginBottom(height));
    }

    private DeviceRgb getScoreColor(int score) {
        if (score >= 80) return new DeviceRgb(16,  185, 129); // green
        if (score >= 60) return new DeviceRgb(245, 158,  11); // amber
        if (score >= 40) return new DeviceRgb(249, 115,  22); // orange
        return new DeviceRgb(239, 68, 68); // red
    }

    private String getScoreLabel(int score) {
        if (score >= 80) return "EXCELLENT MATCH";
        if (score >= 60) return "GOOD MATCH";
        if (score >= 40) return "FAIR MATCH";
        return "NEEDS WORK";
    }
}
