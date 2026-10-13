import os
import sys
import math
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import (
    Drawing, Rect, String, Line, Polygon, Group
)

# Numbered Canvas for Two-Pass Page Numbering & Clean Headers/Footers
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#475569"))

        # Header (Pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, letter[1] - 34, "CAMPYTEQ ENTERPRISE ERP & AI ECOSYSTEM")
            self.setFont("Helvetica", 7.5)
            self.drawRightString(letter[0] - 54, letter[1] - 34, "DATA FLOW DIAGRAMS & SYSTEM WORKFLOW SPECIFICATION")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.75)
            self.line(54, letter[1] - 40, letter[0] - 54, letter[1] - 40)

        # Footer
        self.setFont("Helvetica", 7.5)
        self.drawString(54, 28, "CampyTeq Higher-Ed OS • React (Vite) + Django 5 + PostgreSQL • Strictly Zero Redis/Docker")
        text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 28, text)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.75)
        self.line(54, 38, letter[0] - 54, 38)

        self.restoreState()


# --- Vector Drawing Helper Functions for Clean DFDs ---

def draw_arrow_head(g, x, y, angle_rad, size=6, color=colors.HexColor("#334155")):
    """Draws a clean filled arrowhead at (x, y) pointing in angle_rad direction."""
    tip = (x, y)
    left = (
        x - size * math.cos(angle_rad - math.pi / 6),
        y - size * math.sin(angle_rad - math.pi / 6)
    )
    right = (
        x - size * math.cos(angle_rad + math.pi / 6),
        y - size * math.sin(angle_rad + math.pi / 6)
    )
    g.add(Polygon([tip[0], tip[1], left[0], left[1], right[0], right[1]],
                  fillColor=color, strokeColor=color, strokeWidth=0.5))

def draw_directed_line(g, x1, y1, x2, y2, color=colors.HexColor("#475569"), stroke_width=1.2, arrow=True):
    """Draws a line from (x1, y1) to (x2, y2) with an optional arrowhead at (x2, y2)."""
    g.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=stroke_width))
    if arrow:
        angle = math.atan2(y2 - y1, x2 - x1)
        draw_arrow_head(g, x2, y2, angle, size=6, color=color)

def draw_entity(g, x, y, w, h, title, subtitle="", bg=colors.HexColor("#f1f5f9"), stroke=colors.HexColor("#334155")):
    """Draws an External Entity rectangle (DFD standard)."""
    # Soft drop shadow
    g.add(Rect(x + 2, y - 2, w, h, rx=3, ry=3, fillColor=colors.HexColor("#e2e8f0"), strokeColor=None))
    # Main Box
    g.add(Rect(x, y, w, h, rx=3, ry=3, fillColor=bg, strokeColor=stroke, strokeWidth=1.2))
    # Top accent line
    g.add(Line(x, y + h - 1, x + w, y + h - 1, strokeColor=stroke, strokeWidth=2))
    
    if subtitle:
        g.add(String(x + w / 2, y + h / 2 + 3, title, fontName="Helvetica-Bold", fontSize=8,
                     fillColor=colors.HexColor("#0f172a"), textAnchor="middle"))
        g.add(String(x + w / 2, y + h / 2 - 8, subtitle, fontName="Helvetica", fontSize=6.5,
                     fillColor=colors.HexColor("#475569"), textAnchor="middle"))
    else:
        g.add(String(x + w / 2, y + h / 2 - 3, title, fontName="Helvetica-Bold", fontSize=8,
                     fillColor=colors.HexColor("#0f172a"), textAnchor="middle"))

def draw_process(g, x, y, w, h, proc_id, title, bg=colors.HexColor("#e0e7ff"), stroke=colors.HexColor("#4338ca")):
    """Draws a DFD Process Bubble (rounded rectangle with process ID header)."""
    g.add(Rect(x + 2, y - 2, w, h, rx=6, ry=6, fillColor=colors.HexColor("#c7d2fe"), strokeColor=None))
    g.add(Rect(x, y, w, h, rx=6, ry=6, fillColor=bg, strokeColor=stroke, strokeWidth=1.2))
    
    # Header division line for process ID
    g.add(Line(x, y + h - 14, x + w, y + h - 14, strokeColor=stroke, strokeWidth=0.8))
    g.add(String(x + w / 2, y + h - 10, proc_id, fontName="Helvetica-Bold", fontSize=7,
                 fillColor=stroke, textAnchor="middle"))
    g.add(String(x + w / 2, y + (h - 14) / 2 - 3, title, fontName="Helvetica-Bold", fontSize=7.5,
                 fillColor=colors.HexColor("#1e1b4b"), textAnchor="middle"))

def draw_datastore(g, x, y, w, h, ds_id, title):
    """Draws a DFD Data Store (two open parallel horizontal lines with ID slot)."""
    bg = colors.HexColor("#fef3c7")
    stroke = colors.HexColor("#d97706")
    g.add(Rect(x, y, w, h, fillColor=bg, strokeColor=None))
    # Top and bottom parallel lines
    g.add(Line(x, y + h, x + w, y + h, strokeColor=stroke, strokeWidth=1.5))
    g.add(Line(x, y, x + w, y, strokeColor=stroke, strokeWidth=1.5))
    # Left vertical boundary line
    g.add(Line(x, y, x, y + h, strokeColor=stroke, strokeWidth=1.5))
    # Vertical divider for ID
    g.add(Line(x + 24, y, x + 24, y + h, strokeColor=stroke, strokeWidth=1))
    
    g.add(String(x + 12, y + h / 2 - 3, ds_id, fontName="Helvetica-Bold", fontSize=7,
                 fillColor=colors.HexColor("#92400e"), textAnchor="middle"))
    g.add(String(x + 28 + (w - 28) / 2, y + h / 2 - 3, title, fontName="Helvetica-Bold", fontSize=7.5,
                 fillColor=colors.HexColor("#78350f"), textAnchor="middle"))


# --- High-Resolution Vector DFD Builders ---

def build_dfd_level_0():
    """Builds clean vector DFD Level 0 (Context Diagram). Width: 504, Height: 240."""
    d = Drawing(504, 240)
    
    # Outer frame
    d.add(Rect(0, 0, 504, 240, rx=4, ry=4, fillColor=colors.HexColor("#faf5ff"), strokeColor=colors.HexColor("#e9d5ff"), strokeWidth=1))
    d.add(String(10, 226, "DFD LEVEL 0: CONTEXT DIAGRAM — CAMPYTEQ ENTERPRISE ECOSYSTEM", fontName="Helvetica-Bold", fontSize=7.5, fillColor=colors.HexColor("#6b21a8")))

    # Central Process Bubble: 0.0 CampyTeq
    cx, cy, cw, ch = 182, 85, 140, 68
    d.add(Rect(cx + 3, cy - 3, cw, ch, rx=10, ry=10, fillColor=colors.HexColor("#c7d2fe"), strokeColor=None))
    d.add(Rect(cx, cy, cw, ch, rx=10, ry=10, fillColor=colors.HexColor("#1e1b4b"), strokeColor=colors.HexColor("#4338ca"), strokeWidth=2))
    d.add(String(cx + cw / 2, cy + 48, "0.0 CENTRAL PLATFORM", fontName="Helvetica-Bold", fontSize=7.5, fillColor=colors.HexColor("#a5b4fc"), textAnchor="middle"))
    d.add(String(cx + cw / 2, cy + 32, "CAMPYTEQ ERP & AI", fontName="Helvetica-Bold", fontSize=10, fillColor=colors.white, textAnchor="middle"))
    d.add(String(cx + cw / 2, cy + 18, "Unified Campus Operating System", fontName="Helvetica", fontSize=6.5, fillColor=colors.HexColor("#cbd5e1"), textAnchor="middle"))

    # External Entities
    # 1. Student (Top Left)
    draw_entity(d, 20, 160, 110, 42, "STUDENT", "Enrolled Scholar", bg=colors.HexColor("#eff6ff"), stroke=colors.HexColor("#2563eb"))
    # 2. Faculty / Mentor (Bottom Left)
    draw_entity(d, 20, 30, 110, 42, "FACULTY / MENTOR", "Unified Classroom & Mentee", bg=colors.HexColor("#f0fdf4"), stroke=colors.HexColor("#16a34a"))
    # 3. Principal / Executive (Top Right)
    draw_entity(d, 374, 160, 110, 42, "PRINCIPAL", "Institutional Executive", bg=colors.HexColor("#fdf2f8"), stroke=colors.HexColor("#db2777"))
    # 4. HOD (Bottom Right)
    draw_entity(d, 374, 30, 110, 42, "HEAD OF DEPT (HOD)", "Department Chair", bg=colors.HexColor("#fff7ed"), stroke=colors.HexColor("#ea580c"))
    # 5. Security & Operations (Bottom Center)
    draw_entity(d, 185, 12, 134, 34, "SECURITY & PRINT/LIB STAFF", "Operational Support", bg=colors.HexColor("#f8fafc"), stroke=colors.HexColor("#475569"))

    # Directed Flow Lines with precise badges
    # Student -> Central
    draw_directed_line(d, 130, 185, 182, 135)
    d.add(String(125, 160, "Leave, Fees, Orders", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#1e40af"), textAnchor="end"))
    # Central -> Student
    draw_directed_line(d, 182, 120, 130, 170)
    d.add(String(130, 138, "Results, Attendance %, Passes", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#0369a1"), textAnchor="end"))

    # Faculty -> Central
    draw_directed_line(d, 130, 60, 182, 100)
    d.add(String(125, 80, "Attendance, Grades, Leaves", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#166534"), textAnchor="end"))
    # Central -> Faculty
    draw_directed_line(d, 182, 90, 130, 45)
    d.add(String(125, 55, "Schedules, AI Radar, CCTV", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#15803d"), textAnchor="end"))

    # Central -> Principal
    draw_directed_line(d, 322, 135, 374, 185)
    d.add(String(375, 155, "Executive KPIs, CCTV, Audit Logs", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#9d174d"), textAnchor="start"))
    # Principal -> Central
    draw_directed_line(d, 374, 170, 322, 120)
    d.add(String(375, 138, "Final Leave Approvals, Venues", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#be185d"), textAnchor="start"))

    # Central -> HOD
    draw_directed_line(d, 322, 100, 374, 60)
    d.add(String(375, 85, "Dept Reports, Staff Leaves, CCTV", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#c2410c"), textAnchor="start"))
    # HOD -> Central
    draw_directed_line(d, 374, 45, 322, 90)
    d.add(String(375, 60, "Leave Recommend, Curriculums", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#9a3412"), textAnchor="start"))

    # Security & Staff -> Central
    draw_directed_line(d, 230, 46, 230, 85)
    d.add(String(225, 63, "Gate Logs, Jobs Done", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#334155"), textAnchor="end"))
    # Central -> Security & Staff
    draw_directed_line(d, 274, 85, 274, 46)
    d.add(String(279, 63, "Queues, Passes, Cameras", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#334155"), textAnchor="start"))

    return d


def build_dfd_level_1():
    """Builds clean vector DFD Level 1 (Process Decomposition). Width: 504, Height: 260."""
    d = Drawing(504, 260)
    
    # Outer frame
    d.add(Rect(0, 0, 504, 260, rx=4, ry=4, fillColor=colors.HexColor("#f8fafc"), strokeColor=colors.HexColor("#cbd5e1"), strokeWidth=1))
    d.add(String(10, 246, "DFD LEVEL 1: SUBSYSTEM PROCESS DECOMPOSITION & DATA FLOW", fontName="Helvetica-Bold", fontSize=7.5, fillColor=colors.HexColor("#334155")))

    # Process 1.0 Leave Hierarchy
    draw_process(d, 30, 160, 100, 50, "PROCESS 1.0", "Leave Hierarchy")
    draw_datastore(d, 30, 115, 100, 24, "D1", "Leave Requests DB")
    draw_directed_line(d, 80, 160, 80, 139)

    # Process 2.0 Venue Booking
    draw_process(d, 140, 160, 105, 50, "PROCESS 2.0", "Venue Booking")
    draw_datastore(d, 140, 115, 105, 24, "D2", "Facility Bookings DB")
    draw_directed_line(d, 192, 160, 192, 139)

    # Process 3.0 Campus Print Shop
    draw_process(d, 255, 160, 105, 50, "PROCESS 3.0", "Print Shop Queue")
    draw_datastore(d, 255, 115, 105, 24, "D3", "Print Orders DB")
    draw_directed_line(d, 307, 160, 307, 139)

    # Process 4.0 Library Circulation
    draw_process(d, 370, 160, 105, 50, "PROCESS 4.0", "Library Catalog")
    draw_datastore(d, 370, 115, 105, 24, "D4", "Library Circulation DB")
    draw_directed_line(d, 422, 160, 422, 139)

    # Process 5.0 AI Risk Radar & CCTV (Spanning bottom center)
    draw_process(d, 150, 25, 204, 48, "PROCESS 5.0", "AI Radar & Security Surveillance")
    draw_datastore(d, 150, 0, 204, 18, "D5", "AI Risk Score & Attendance Log DB")
    draw_directed_line(d, 252, 25, 252, 18)

    # External Actors connected across subsystems (Left & Right margins)
    # Student / Faculty on Left
    draw_entity(d, 10, 25, 90, 45, "STUDENTS & FACULTY", "Primary Requesters", bg=colors.HexColor("#eff6ff"), stroke=colors.HexColor("#2563eb"))
    # HOD & Principal on Right
    draw_entity(d, 404, 25, 90, 45, "HOD & PRINCIPAL", "Review Authorities", bg=colors.HexColor("#fdf2f8"), stroke=colors.HexColor("#db2777"))

    # Connect Actors to Subsystems
    # Student/Faculty -> Leave Process 1.0
    draw_directed_line(d, 55, 70, 55, 160)
    d.add(String(50, 95, "Leave Req", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#1e40af"), textAnchor="end"))

    # Student/Faculty -> Venue Process 2.0
    draw_directed_line(d, 80, 70, 150, 160)
    d.add(String(125, 95, "Book Venue", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#0284c7"), textAnchor="middle"))

    # Student/Faculty -> AI Radar 5.0
    draw_directed_line(d, 100, 45, 150, 45)
    d.add(String(125, 50, "Attendance", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#16a34a"), textAnchor="middle"))

    # HOD/Principal -> Leave Review 1.0 (Horizontal across top)
    draw_directed_line(d, 404, 60, 360, 60, arrow=False)
    draw_directed_line(d, 440, 70, 440, 225, arrow=False)
    draw_directed_line(d, 440, 225, 80, 225, arrow=False)
    draw_directed_line(d, 80, 225, 80, 210)
    d.add(String(252, 228, "Multi-Tier Approval Routing (Student -> Mentor; Faculty -> HOD -> Principal)", fontName="Helvetica-Bold", fontSize=6.5, fillColor=colors.HexColor("#991b1b"), textAnchor="middle"))

    # AI Radar -> HOD/Principal
    draw_directed_line(d, 354, 45, 404, 45)
    d.add(String(379, 50, "Risk Radar", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#9333ea"), textAnchor="middle"))

    return d


def build_dfd_level_2_leave():
    """Builds clean vector DFD Level 2 for the Multi-Tier Leave Approval Hierarchy. Width: 504, Height: 230."""
    d = Drawing(504, 230)
    
    # Outer container
    d.add(Rect(0, 0, 504, 230, rx=4, ry=4, fillColor=colors.HexColor("#ffffff"), strokeColor=colors.HexColor("#e2e8f0"), strokeWidth=1))
    d.add(String(10, 216, "DFD LEVEL 2: DETAILED LEAVE APPROVAL DATA FLOW & ESCALATION TIERS", fontName="Helvetica-Bold", fontSize=7.5, fillColor=colors.HexColor("#1e1b4b")))

    # --- SECTION A: STUDENT LEAVE (Top Swimlane) ---
    d.add(Rect(10, 118, 484, 88, rx=4, ry=4, fillColor=colors.HexColor("#f0f9ff"), strokeColor=colors.HexColor("#bae6fd"), strokeWidth=0.8))
    d.add(String(20, 192, "TIER 1: STUDENT LEAVE WORKFLOW (Direct Mentor Resolution)", fontName="Helvetica-Bold", fontSize=7, fillColor=colors.HexColor("#0369a1")))

    # Nodes
    draw_entity(d, 25, 134, 75, 38, "STUDENT", "Submits Leave", bg=colors.HexColor("#ffffff"), stroke=colors.HexColor("#0284c7"))
    draw_process(d, 140, 132, 100, 42, "PROCESS 1.1", "Route to Mentor")
    draw_entity(d, 275, 134, 80, 38, "FACULTY MENTOR", "Reviewer", bg=colors.HexColor("#ffffff"), stroke=colors.HexColor("#0284c7"))
    
    # Final Result Nodes
    draw_entity(d, 400, 154, 84, 24, "APPROVED", "Status=100%", bg=colors.HexColor("#dcfce7"), stroke=colors.HexColor("#16a34a"))
    draw_entity(d, 400, 124, 84, 24, "REJECTED", "With Reason", bg=colors.HexColor("#fee2e2"), stroke=colors.HexColor("#dc2626"))

    # Connectors
    draw_directed_line(d, 100, 153, 140, 153)
    d.add(String(120, 157, "Apply", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#0284c7"), textAnchor="middle"))

    draw_directed_line(d, 240, 153, 275, 153)
    d.add(String(257, 157, "Assign", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#0284c7"), textAnchor="middle"))

    draw_directed_line(d, 355, 160, 400, 166)
    draw_directed_line(d, 355, 145, 400, 136)

    # --- SECTION B: FACULTY / MENTOR LEAVE (Bottom Swimlane) ---
    d.add(Rect(10, 14, 484, 94, rx=4, ry=4, fillColor=colors.HexColor("#fff7ed"), strokeColor=colors.HexColor("#fed7aa"), strokeWidth=0.8))
    d.add(String(20, 95, "TIER 2: FACULTY & MENTOR LEAVE WORKFLOW (Principal <- HOD <- Faculty Multi-Tier)", fontName="Helvetica-Bold", fontSize=7, fillColor=colors.HexColor("#c2410c")))

    # Nodes
    draw_entity(d, 25, 30, 75, 42, "FACULTY MEMBER", "Applicant", bg=colors.HexColor("#ffffff"), stroke=colors.HexColor("#ea580c"))
    draw_process(d, 130, 28, 90, 44, "PROCESS 2.1", "HOD Review Tier")
    draw_entity(d, 250, 30, 75, 42, "DEPT HOD", "Recommends", bg=colors.HexColor("#ffffff"), stroke=colors.HexColor("#ea580c"))
    draw_process(d, 355, 28, 95, 44, "PROCESS 2.2", "Principal Sign-Off")
    
    # Final Result Nodes
    draw_entity(d, 465, 48, 25, 20, "OK", "Pass", bg=colors.HexColor("#dcfce7"), stroke=colors.HexColor("#16a34a"))
    draw_entity(d, 465, 24, 25, 20, "NO", "Fail", bg=colors.HexColor("#fee2e2"), stroke=colors.HexColor("#dc2626"))

    # Connectors
    draw_directed_line(d, 100, 51, 130, 51)
    d.add(String(115, 55, "Apply", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#ea580c"), textAnchor="middle"))

    draw_directed_line(d, 220, 51, 250, 51)
    d.add(String(235, 55, "Route", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#ea580c"), textAnchor="middle"))

    draw_directed_line(d, 325, 51, 355, 51)
    d.add(String(340, 55, "Promote", fontName="Helvetica-Bold", fontSize=6, fillColor=colors.HexColor("#ea580c"), textAnchor="middle"))

    draw_directed_line(d, 450, 55, 465, 58)
    draw_directed_line(d, 450, 40, 465, 34)

    return d


# --- Document Compiler ---

def generate_pdf(filename="CAMPYTEQ_FULL_WORKFLOW_SPECIFICATION.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=50,
        bottomMargin=50,
    )

    styles = getSampleStyleSheet()

    primary_color = colors.HexColor("#1e1b4b")  # Dark Indigo
    secondary_color = colors.HexColor("#4338ca") # Indigo Accent
    dark_text = colors.HexColor("#0f172a")      # Slate 900
    border_color = colors.HexColor("#cbd5e1")   # Slate 300
    bg_light = colors.HexColor("#f8fafc")       # Slate 50

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=4,
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=secondary_color,
        spaceAfter=12,
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=dark_text,
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=dark_text,
        leftIndent=10,
        spaceAfter=3,
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white,
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=dark_text,
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=dark_text,
    )

    story = []

    # Title & Header Banner
    story.append(Paragraph("CAMPYTEQ ENTERPRISE SYSTEM SPECIFICATION", title_style))
    story.append(Paragraph("Unified Higher-Ed ERP & AI Intelligence • Multi-Role Governance & Formal Data Flow Diagrams", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=secondary_color, spaceAfter=8))

    # Architectural Overview
    story.append(Paragraph("1. System Architecture & Tech Boundaries", h1_style))
    story.append(Paragraph(
        "<b>CampyTeq</b> operates strictly on a clean, production-grade architecture: <b>React (Vite) Single Page Application</b> with Tailwind CSS, "
        "<b>Django 5.x REST Framework</b> backend in Python 3.12, <b>PostgreSQL</b> relational database, and native <b>Python AI & Computer Vision</b> analytics. "
        "Strict multi-tenant database isolation ensures complete security and zero unnecessary third-party brokers (Docker, Redis, Next.js, and mobile packages are eliminated).",
        body_style
    ))

    # User Roles Matrix
    story.append(Paragraph("2. Account Capabilities & Authorization Matrix", h1_style))
    story.append(Paragraph(
        "Role-based access control enforces granular permissions across all institutional stakeholders:",
        body_style
    ))

    role_data = [
        [
            Paragraph("Role / Account", table_header),
            Paragraph("What They Can See (Visibility)", table_header),
            Paragraph("What They Can Do (Actions & Approvals)", table_header),
        ],
        [
            Paragraph("<b>SUPERADMIN</b>", table_cell_bold),
            Paragraph("• All Colleges / Multi-tenant directories<br/>• Global storage & DB metrics<br/>• Platform-wide Audit Logs", table_cell),
            Paragraph("• Provision new college tenants<br/>• Configure institutional subscription plans<br/>• Reset institution root admin credentials", table_cell),
        ],
        [
            Paragraph("<b>PRINCIPAL</b>", table_cell_bold),
            Paragraph("• Executive KPI Dashboard (Enrollment, Fees)<br/>• All 6 Departments (Students, Faculty, Staff)<br/>• <b>Authorized CCTV Cameras (All Zones)</b><br/>• AI Radar Retention Risk Heatmaps<br/>• Institution Payroll & Fee Reports<br/><i>(Hidden: Print Shop & Apply Leave)</i>", table_cell),
            Paragraph("• <b>Final approval for Faculty & HOD leaves</b><br/>• Approve venue & seminar hall bookings<br/>• Publish institution-wide announcements<br/>• Sign off staff payroll registers", table_cell),
        ],
        [
            Paragraph("<b>HEAD OF DEPT (HOD)</b>", table_cell_bold),
            Paragraph("• Departmental Student & Faculty rosters<br/>• Department Course Curriculums & Timetables<br/>• <b>Departmental CCTV Cameras</b><br/>• Department AI Radar Risk metrics<br/>• Department Faculty Leave Requests", table_cell),
            Paragraph("• <b>Review Faculty leaves & recommend to Principal</b><br/>• Assign subjects, timetables, and labs to Faculty<br/>• Escalate student attendance/risk issues<br/>• Approve student internal assessment results", table_cell),
        ],
        [
            Paragraph("<b>FACULTY / MENTOR (Unified)</b>", table_cell_bold),
            Paragraph("• Assigned Classes, Timetables, & Syllabus<br/>• Student Rosters & Attendance registers<br/>• Mentee List (Mentorship Dashboard)<br/>• Mentee AI Risk radar & performance trends<br/>• <b>Authorized CCTV (Labs & Classrooms)</b><br/>• Library Catalog & Campus Print Queue", table_cell),
            Paragraph("• Mark daily lecture attendance<br/>• Create, publish, & grade assignments & exams<br/>• <b>Review & Approve/Reject assigned Mentee leaves</b><br/>• Record 1-on-1 counseling / mentorship notes<br/>• <b>Apply for personal leaves (auto-routed to HOD)</b><br/>• Book lab facilities & submit print jobs", table_cell),
        ],
        [
            Paragraph("<b>STUDENT</b>", table_cell_bold),
            Paragraph("• Academic Dashboard & Timetable<br/>• Attendance % breakdown & warnings<br/>• Course Assignments & due dates<br/>• Exam schedules & Grade cards<br/>• Outstanding Fee Invoices & Receipts<br/>• Library Catalog, loans & reservations", table_cell),
            Paragraph("• <b>Apply for leaves (auto-routed to Mentor)</b><br/>• Submit assignment files & track scores<br/>• Pay college fees online & download receipts<br/>• Submit document print requests to Print Shop<br/>• Reserve library books & check fine balances", table_cell),
        ],
        [
            Paragraph("<b>SECURITY OFFICER</b>", table_cell_bold),
            Paragraph("• <b>Authorized CCTV Feeds (Gates, Perimeter)</b><br/>• Visitor log & Vehicle entry directory<br/>• Student gate-pass approval status", table_cell),
            Paragraph("• Scan student RFID/QR gate passes on entry/exit<br/>• Log visitor identity, host person, and purpose<br/>• Raise security emergency alerts to Principal", table_cell),
        ],
        [
            Paragraph("<b>ACCOUNTANT / FINANCE</b>", table_cell_bold),
            Paragraph("• Fee Structures & Payment Schedules<br/>• Student Collections, Dues, & Defaulters<br/>• Salary & Payroll registers for all staff", table_cell),
            Paragraph("• Generate fee invoices & concessions<br/>• Process payment reconciliations & refunds<br/>• Disburse monthly staff salary slips", table_cell),
        ],
        [
            Paragraph("<b>PRINT SHOP STAFF</b>", table_cell_bold),
            Paragraph("• Real-time Print Order Queue & specs<br/>• Uploaded PDF document previews<br/>• Daily print shop revenue & paper stock", table_cell),
            Paragraph("• Accept incoming print jobs & execute hardware prints<br/>• Update status: Pending &rarr; Ready for Pickup &rarr; Done<br/>• Collect cash/counter payments if unpaid", table_cell),
        ],
        [
            Paragraph("<b>LIBRARY STAFF</b>", table_cell_bold),
            Paragraph("• Library Catalog (Books, ISBN, copies)<br/>• Active Issue/Return circulation register<br/>• Overdue loans list & accumulated fines", table_cell),
            Paragraph("• Add/update book copies, racks, & barcode tags<br/>• Issue books to students/faculty via barcode scan<br/>• Receive returned books & clear fines upon receipt", table_cell),
        ],
    ]

    t_roles = Table(role_data, colWidths=[110, 194, 200])
    t_roles.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), secondary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, bg_light]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))

    story.append(t_roles)
    story.append(Spacer(1, 10))

    # --- PAGE BREAK FOR CLEAN DFDs ---
    story.append(PageBreak())

    # Section 3: Clean Vector DFDs
    story.append(Paragraph("3. Data Flow Diagrams (DFD)", h1_style))
    story.append(Paragraph(
        "The following vector diagrams represent the formal Data Flow Architecture across all operational subsystems.",
        body_style
    ))

    # DFD Level 0 Vector
    story.append(Paragraph("A. DFD Level 0: Global Context Diagram", ParagraphStyle('H2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=10, textColor=secondary_color, spaceBefore=4, spaceAfter=4)))
    story.append(build_dfd_level_0())
    story.append(Spacer(1, 10))

    # DFD Level 1 Vector
    story.append(Paragraph("B. DFD Level 1: Subsystem Process Decomposition", ParagraphStyle('H2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=10, textColor=secondary_color, spaceBefore=4, spaceAfter=4)))
    story.append(build_dfd_level_1())
    story.append(Spacer(1, 10))

    # --- PAGE BREAK FOR DFD LEVEL 2 & DETAILED LIFECYCLES ---
    story.append(PageBreak())

    # DFD Level 2 Vector (Multi-Tier Leave Hierarchy)
    story.append(Paragraph("C. DFD Level 2: Multi-Tier Leave Request Workflow", ParagraphStyle('H2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=10, textColor=secondary_color, spaceBefore=4, spaceAfter=4)))
    story.append(build_dfd_level_2_leave())
    story.append(Spacer(1, 8))

    # Step-by-Step Workflow Explanations
    story.append(Paragraph("4. End-to-End Request Lifecycles", h1_style))

    # Workflow 1: Leave
    story.append(Paragraph("<b>1. Multi-Tier Leave Approval Hierarchy:</b>", ParagraphStyle('Sub', parent=body_style, fontName='Helvetica-Bold', textColor=secondary_color)))
    story.append(Paragraph("• <b>Student Leave Sub-flow:</b> The student submits dates, leave type, and reason. The backend automatically determines the student's assigned Mentor (Faculty profile) and sets <code>routed_tier='MENTOR'</code>. The mentor reviews and issues an immediate decision (<code>APPROVED</code> or <code>REJECTED</code> with feedback).", bullet_style))
    story.append(Paragraph("• <b>Staff Leave Sub-flow (Principal &larr; HOD &larr; Faculty):</b> When a faculty member applies for leave, it is routed to their Department HOD (<code>routed_tier='HOD'</code>). Upon HOD recommendation, the system promotes the request to <code>routed_tier='PRINCIPAL'</code>. The Principal grants final institutional sign-off, notifying both the applicant and HOD.", bullet_style))
    story.append(Spacer(1, 4))

    # Workflow 2: Print Shop
    story.append(Paragraph("<b>2. Campus Print Shop Service:</b>", ParagraphStyle('Sub', parent=body_style, fontName='Helvetica-Bold', textColor=secondary_color)))
    story.append(Paragraph("• Students and Faculty upload PDF documents, choose print properties (Color / Black & White, Single / Duplex, Copies).", bullet_style))
    story.append(Paragraph("• The system dynamically calculates tariffs (e.g. ₹2/page BW, ₹5/page Color). The order is queued for the Print Shop Staff.", bullet_style))
    story.append(Paragraph("• Staff marks job <code>PROCESSING</code> &rarr; <code>READY_FOR_PICKUP</code> (push alert dispatched to user) &rarr; user collects hardcopy at counter &rarr; <code>COMPLETED</code>.", bullet_style))
    story.append(Spacer(1, 4))

    # Workflow 3: Facility Booking
    story.append(Paragraph("<b>3. Venue & Facility Booking:</b>", ParagraphStyle('Sub', parent=body_style, fontName='Helvetica-Bold', textColor=secondary_color)))
    story.append(Paragraph("• Faculty, Mentors, and HODs browse seminar halls, auditoriums, and computer labs.", bullet_style))
    story.append(Paragraph("• Backend algorithm checks for zero schedule collisions across time intervals. The reservation is submitted for Principal / Admin sign-off.", bullet_style))
    story.append(Paragraph("• Upon approval, the facility calendar is locked and security/maintenance teams are notified.", bullet_style))
    story.append(Spacer(1, 4))

    # Workflow 4: Library Circulation
    story.append(Paragraph("<b>4. Library Circulation & Fines:</b>", ParagraphStyle('Sub', parent=body_style, fontName='Helvetica-Bold', textColor=secondary_color)))
    story.append(Paragraph("• Users search the catalog and place 24-hour holds on available books.", bullet_style))
    story.append(Paragraph("• At the circulation desk, staff scans student barcode and book barcode, issuing the book for 14 days.", bullet_style))
    story.append(Paragraph("• If overdue, daily fine accumulation updates automatically until returned and cleared.", bullet_style))
    story.append(Spacer(1, 4))

    # Workflow 5: AI Radar & Cameras
    story.append(Paragraph("<b>5. AI Radar Risk Intelligence & CCTV Surveillance:</b>", ParagraphStyle('Sub', parent=body_style, fontName='Helvetica-Bold', textColor=secondary_color)))
    story.append(Paragraph("• <b>CCTV Camera Authorization:</b> Live feeds are strictly restricted to <b>Principal, Security, HOD, and Faculty</b>.", bullet_style))
    story.append(Paragraph("• <b>AI Radar Computation:</b> Real-time Python AI algorithms aggregate lecture attendance velocity, assignment completion, and test marks to classify students into <b>HIGH RISK</b> (>75% dropout probability), <b>MEDIUM RISK</b>, or <b>LOW RISK</b>.", bullet_style))
    story.append(Paragraph("• Retention intervention notices are dispatched immediately to the assigned Faculty Mentor and HOD for 1-on-1 counseling.", bullet_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    generate_pdf()
