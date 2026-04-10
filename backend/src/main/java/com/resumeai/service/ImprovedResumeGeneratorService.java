package com.resumeai.service;

import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;

/**
 * ImprovedResumeGeneratorService
 *
 * Creates a polished, ATS-friendly DOCX resume using Apache POI.
 *
 * ROOT CAUSE OF ORIGINAL ERRORS:
 *   Apache POI's XML schema has two distinct border types:
 *     CTPBdr  = paragraph border CONTAINER (holds top/bottom/left/right edges)
 *     CTBorder = a single border EDGE
 *   The original code confused them in conditional expressions.
 *   Fix: always call addNewPBdr() on CTPPr to get CTPBdr,
 *   then call addNewTop()/addNewBottom() on CTPBdr to get CTBorder.
 */
@Service
public class ImprovedResumeGeneratorService {

    public byte[] generateImprovedResume(Map<String, Object> resumeData) throws IOException {
        XWPFDocument doc = new XWPFDocument();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        setPageMargins(doc);

        String candidateName = getString(resumeData, "candidateName", "Candidate");
        addNameHeader(doc, candidateName);

        String summary = getString(resumeData, "professionalSummary", "");
        if (!summary.isBlank()) {
            addSectionHeading(doc, "PROFESSIONAL SUMMARY");
            addBodyParagraph(doc, summary);
            addSpacerParagraph(doc);
        }

        @SuppressWarnings("unchecked")
        List<String> skills = (List<String>) resumeData.getOrDefault("skills", List.of());
        if (!skills.isEmpty()) {
            addSectionHeading(doc, "TECHNICAL SKILLS");
            addSkillsGrid(doc, skills);
            addSpacerParagraph(doc);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> experience =
                (List<Map<String, Object>>) resumeData.getOrDefault("experience", List.of());
        if (!experience.isEmpty()) {
            addSectionHeading(doc, "PROFESSIONAL EXPERIENCE");
            for (Map<String, Object> job : experience) {
                addExperienceEntry(doc, job);
            }
            addSpacerParagraph(doc);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> education =
                (List<Map<String, Object>>) resumeData.getOrDefault("education", List.of());
        if (!education.isEmpty()) {
            addSectionHeading(doc, "EDUCATION");
            for (Map<String, Object> edu : education) {
                addEducationEntry(doc, edu);
            }
            addSpacerParagraph(doc);
        }

        @SuppressWarnings("unchecked")
        List<String> improvements =
                (List<String>) resumeData.getOrDefault("improvements", List.of());
        if (!improvements.isEmpty()) {
            addSectionHeading(doc, "AI IMPROVEMENT NOTES");
            for (String note : improvements) {
                addBulletPoint(doc, note);
            }
        }

        doc.write(baos);
        doc.close();
        return baos.toByteArray();
    }

    // ─────────────────────────────────────────────────────────
    //  PAGE SETUP
    // ─────────────────────────────────────────────────────────

    private void setPageMargins(XWPFDocument doc) {
        CTSectPr sectPr = doc.getDocument().getBody().addNewSectPr();
        CTPageMar pageMar = sectPr.addNewPgMar();
        pageMar.setTop(BigInteger.valueOf(1080));
        pageMar.setBottom(BigInteger.valueOf(1080));
        pageMar.setLeft(BigInteger.valueOf(1080));
        pageMar.setRight(BigInteger.valueOf(1080));
    }

    // ─────────────────────────────────────────────────────────
    //  CONTENT BUILDERS
    // ─────────────────────────────────────────────────────────

    private void addNameHeader(XWPFDocument doc, String name) {
        XWPFParagraph para = doc.createParagraph();
        para.setAlignment(ParagraphAlignment.CENTER);
        para.setSpacingAfter(60);
        XWPFRun run = para.createRun();
        run.setText(name);
        run.setBold(true);
        run.setFontSize(24);
        run.setFontFamily("Calibri");
        run.setColor("1E293B");

        // Thin cyan divider line below the name
        XWPFParagraph divider = doc.createParagraph();
        divider.setSpacingBefore(40);
        divider.setSpacingAfter(120);
        addBottomBorder(divider, "006EB8", 4);
    }

    private void addSectionHeading(XWPFDocument doc, String title) {
        XWPFParagraph para = doc.createParagraph();
        para.setSpacingBefore(160);
        para.setSpacingAfter(80);
        addTopBorder(para, "006EB8", 6);

        XWPFRun run = para.createRun();
        run.setText(title);
        run.setBold(true);
        run.setFontSize(10);
        run.setFontFamily("Calibri");
        run.setColor("006EB8");
        run.setCapitalized(true);
    }

    private void addBodyParagraph(XWPFDocument doc, String text) {
        XWPFParagraph para = doc.createParagraph();
        para.setSpacingAfter(80);
        XWPFRun run = para.createRun();
        run.setText(text);
        run.setFontSize(10);
        run.setFontFamily("Calibri");
        run.setColor("334155");
    }

    private void addSkillsGrid(XWPFDocument doc, List<String> skills) {
        int cols = 3;
        int rows = (int) Math.ceil((double) skills.size() / cols);
        XWPFTable table = doc.createTable(rows, cols);
        table.setWidth("100%");
        removeTableBorders(table);

        for (int i = 0; i < skills.size(); i++) {
            int row = i / cols;
            int col = i % cols;
            XWPFTableCell cell = table.getRow(row).getCell(col);
            XWPFParagraph p = cell.getParagraphs().get(0);
            XWPFRun r = p.createRun();
            r.setText("▪  " + skills.get(i).trim());
            r.setFontSize(9);
            r.setFontFamily("Calibri");
            r.setColor("334155");
        }
    }

    private void addExperienceEntry(XWPFDocument doc, Map<String, Object> job) {
        XWPFParagraph titleLine = doc.createParagraph();
        titleLine.setSpacingBefore(80);
        titleLine.setSpacingAfter(20);
        XWPFRun run = titleLine.createRun();
        run.setText(getString(job, "title", "Role")
                + "  |  " + getString(job, "company", "")
                + "  |  " + getString(job, "period", ""));
        run.setBold(true);
        run.setFontSize(10);
        run.setFontFamily("Calibri");
        run.setColor("1E293B");

        @SuppressWarnings("unchecked")
        List<String> bullets = (List<String>) job.getOrDefault("bullets", List.of());
        for (String bullet : bullets) {
            addBulletPoint(doc, bullet);
        }
    }

    private void addEducationEntry(XWPFDocument doc, Map<String, Object> edu) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingBefore(60);
        p.setSpacingAfter(20);

        XWPFRun degreeRun = p.createRun();
        degreeRun.setText(getString(edu, "degree", "Degree"));
        degreeRun.setBold(true);
        degreeRun.setFontSize(10);
        degreeRun.setFontFamily("Calibri");
        degreeRun.setColor("1E293B");

        XWPFRun instRun = p.createRun();
        instRun.setText("   —   " + getString(edu, "institution", "")
                + "  (" + getString(edu, "year", "") + ")");
        instRun.setFontSize(10);
        instRun.setFontFamily("Calibri");
        instRun.setColor("64748B");
    }

    private void addBulletPoint(XWPFDocument doc, String text) {
        XWPFParagraph para = doc.createParagraph();
        para.setIndentationLeft(360);
        para.setSpacingAfter(40);

        XWPFRun bullet = para.createRun();
        bullet.setText("›  ");
        bullet.setBold(true);
        bullet.setFontSize(10);
        bullet.setColor("006EB8");

        XWPFRun content = para.createRun();
        content.setText(text.trim().replaceAll("^[-•*›\\d.]+\\s*", ""));
        content.setFontSize(10);
        content.setFontFamily("Calibri");
        content.setColor("334155");
    }

    private void addSpacerParagraph(XWPFDocument doc) {
        doc.createParagraph().setSpacingAfter(60);
    }

    // ─────────────────────────────────────────────────────────
    //  BORDER HELPERS
    //
    //  Apache POI schema hierarchy for paragraph borders:
    //    CTPPr  (paragraph properties)
    //      └── CTPBdr  (border CONTAINER — has top/bottom/left/right slots)
    //            └── CTBorder  (a single edge — top OR bottom OR left OR right)
    //
    //  We must NOT mix CTPBdr and CTBorder in conditional expressions.
    //  Steps: getCTP() → getPPr()/addNewPPr() → getPBdr()/addNewPBdr()
    //         → addNewTop()/addNewBottom() → returns CTBorder to configure.
    // ─────────────────────────────────────────────────────────

    private void addTopBorder(XWPFParagraph para, String hexColor, int sz) {
        CTPBdr pBdr = getOrCreatePBdr(para);
        CTBorder top = pBdr.addNewTop();   // CTBorder — single edge
        top.setVal(STBorder.SINGLE);
        top.setSz(BigInteger.valueOf(sz));
        top.setColor(hexColor);
        top.setSpace(BigInteger.valueOf(4));
    }

    private void addBottomBorder(XWPFParagraph para, String hexColor, int sz) {
        CTPBdr pBdr = getOrCreatePBdr(para);
        CTBorder bottom = pBdr.addNewBottom();  // CTBorder — single edge
        bottom.setVal(STBorder.SINGLE);
        bottom.setSz(BigInteger.valueOf(sz));
        bottom.setColor(hexColor);
        bottom.setSpace(BigInteger.valueOf(4));
    }

    /**
     * Gets or creates the CTPBdr (paragraph border container) for a paragraph.
     * CTPBdr is separate from CTBorder — it is the container, not an edge.
     */
    private CTPBdr getOrCreatePBdr(XWPFParagraph para) {
        // Step 1: get or create CTPPr (paragraph properties)
        CTPPr pPr = para.getCTP().getPPr();
        if (pPr == null) {
            pPr = para.getCTP().addNewPPr();
        }
        // Step 2: get or create CTPBdr (border container) from CTPPr
        CTPBdr pBdr = pPr.getPBdr();
        if (pBdr == null) {
            pBdr = pPr.addNewPBdr();
        }
        return pBdr;
    }

    private void removeTableBorders(XWPFTable table) {
        CTTblPr tblPr = table.getCTTbl().getTblPr();
        if (tblPr == null) {
            tblPr = table.getCTTbl().addNewTblPr();
        }
        CTTblBorders borders = tblPr.isSetTblBorders()
                ? tblPr.getTblBorders()
                : tblPr.addNewTblBorders();

        setBorderNone(borders.isSetTop()     ? borders.getTop()     : borders.addNewTop());
        setBorderNone(borders.isSetBottom()  ? borders.getBottom()  : borders.addNewBottom());
        setBorderNone(borders.isSetLeft()    ? borders.getLeft()    : borders.addNewLeft());
        setBorderNone(borders.isSetRight()   ? borders.getRight()   : borders.addNewRight());
        setBorderNone(borders.isSetInsideH() ? borders.getInsideH() : borders.addNewInsideH());
        setBorderNone(borders.isSetInsideV() ? borders.getInsideV() : borders.addNewInsideV());
    }

    private void setBorderNone(CTBorder border) {
        border.setVal(STBorder.NONE);
    }

    // ─────────────────────────────────────────────────────────
    //  UTILITY
    // ─────────────────────────────────────────────────────────

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        return val != null ? val.toString() : defaultValue;
    }
}