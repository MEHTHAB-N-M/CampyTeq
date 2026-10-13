# CampyTeq — Native Full-Stack Operations Runbook

This document details how to run and operate the **CampyTeq** project natively using only **Python**, **Django**, **React**, and **PostgreSQL** without any Docker or external container tools.

---

## Architecture Overview

```
                      [ User Browser ]
                             │
                             ▼
              [ React + Tailwind CSS Frontend ]
                    (http://localhost:3000)
                             │
                             │ REST API (JSON)
                             ▼
                  [ Django / Python Backend ]
                    (http://localhost:8000)
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
      [ PostgreSQL Database ]     [ Python AI Engine ]
            (Port 5432)             (cv-service)
```

---

## 1. Prerequisites

1. **Python 3.11+**
2. **Node.js (v18+) & npm**
3. **PostgreSQL 14+** (e.g., PostgreSQL for Windows with pgAdmin)

---

## 2. Setup & Execution Steps

### Step 1: PostgreSQL Setup
1. Open **pgAdmin** or `psql`.
2. Create a database:
   ```sql
   CREATE DATABASE campyteq_db;
   ```
3. Set your connection URL in `.env` (or let it connect with your Postgres credentials):
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/campyteq_db
   ```
   *(Note: If no PostgreSQL URL is configured, Django will automatically fall back to local `db.sqlite3` for zero-setup instant testing!)*

---

### Step 2: Backend (Django & Python)
Open a terminal in the project root:
```bash
cd backend

# Create & activate Python virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\Activate.ps1

# Linux / Mac:
source venv/bin/activate

# Install pure Python dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Seed sample institutional demo data
python manage.py seed_demo

# Start Django development server
python manage.py runserver
```
* Django API: `http://localhost:8000/api/v1/`
* Swagger/OpenAPI Documentation: `http://localhost:8000/api/docs/`
* Admin Panel: `http://localhost:8000/admin/`

---

### Step 3: Frontend (React & Tailwind CSS)
Open a second terminal window:
```bash
cd frontend

# Install node dependencies
npm install

# Start React development server
npm run dev
```
* Open your browser at: `http://localhost:3000`
* Use the 1-click role switcher on the login screen to test as Principal, HOD, Faculty, Student, Accountant, or Security.

---

### Step 4: Python AI Module (Face Recognition & Detection Stream)
Open a third terminal window:
```bash
cd cv-service
python stream_simulator.py
```
This Python script streams edge detections and face sightings directly into Django's tracking API endpoint.
