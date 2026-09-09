# Industrial Fire Intelligence (SIH26162)

> **Official Problem Statement:** AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data  
> **Theme:** Disaster Management | **Category:** Software | **Organization:** National Technical Research Organisation (NTRO)  
> **Core Principle:** *"A satellite detects a thermal anomaly. We don't simply show 'fire detected' — we investigate what that thermal anomaly is likely to represent."*

---

## 🧭 Repository Structure

```text
├── README.md                           <- Master Overview & Quickstart
├── HOW_TO_RUN.md                       <- Offline presentation & run instructions
├── start_dashboard.bat                 <- 1-Click launcher for Windows
├── docs/
│   ├── 01_MASTER_CONTEXT.md            <- Problem definition, philosophy, and constraints
│   ├── 02_ARCHITECTURE.md              <- System pipeline, spatio-temporal event model
│   ├── 03_DATA_SOURCES.md              <- NASA FIRMS, OSM, WorldCover, Sentinel-2 analysis
│   ├── 04_CLASSIFICATION_APPROACH.md   <- Hierarchical taxonomy & feature definitions
│   ├── 05_ML_RULE.md                   <- Baseline first, anti-leakage, evaluation rules
│   ├── 06_TEAM_STRUCTURE.md            <- 6-person CSE responsibility matrix
│   ├── 07_IMMEDIATE_PLAN.md            <- Phase-by-phase execution order
│   ├── 08_NORTH_STAR.md                <- Advisory principles & technical guardrails
│   ├── 10_EVENT_AGGREGATION_V2.md      <- Centroid clustering & footprint scaling math
│   ├── 11_PHASE2_OSM_INTELLIGENCE.md   <- Geodesic facility association report
│   ├── 12_JUDGE_DEFENSE_AND_DEMO_SCRIPT.md <- 3-minute pitch & tough judge Q&A
│   └── 13_TECHNICAL_SPECIFICATION.md   <- Master Engineering Technical Specification
├── schemas/
│   └── event_intelligence.json         <- Locked JSON Schema contract for UI & API
├── prototype/
│   ├── firms_sample.csv                <- Realistic NASA FIRMS VIIRS test observations
│   ├── thermal_events.py               <- Python spatio-temporal clustering prototype
│   └── thermal_events.js               <- Node.js executable prototype (Runs on Node v25)
└── validation/
    └── scenarios.md                    <- 3 Ground-truth scenarios (Industrial, Agri, Wildfire)
```

---

## ⚡ How to Run on Any PC (After Downloading the ZIP)

Detailed guide also available in [`HOW_TO_RUN.md`](HOW_TO_RUN.md).

### Option 1: 1-Click Launch (Recommended for Windows)
1. Extract the downloaded ZIP.
2. Double-click **`start_dashboard.bat`** in the project root.
3. The server will start and automatically open `http://localhost:3000` in your default browser.

### Option 2: Terminal Command
Open PowerShell or Command Prompt inside the project folder:
```powershell
node dashboard/server.js
```
Then navigate to `http://localhost:3000` in your browser.

### Option 3: Direct File Open (Offline Fallback, No Node.js Needed)
Double-click **`dashboard/index.html`** directly in any browser (Chrome/Edge/Firefox). The pre-compiled bundle (`data_bundle.js`) and local Leaflet vendor files allow the full UI and inspector drawer to function offline without a web server.

---

## 🎯 Verifying the Rehearsed Scenarios

Open `http://localhost:3000` and click the 4 buttons in the top navigation bar:

* 🏭 **Hazira Petrochem Flare**: Focuses on AM/NS Steel & petrochemical cluster (`EVT-V2-0007`, 91% confidence, 563m proximity, 0.85x optical drift).
* ⛽ **Panipat Refinery**: Focuses on IOCL Refinery unit (`EVT-V2-0027`, 91% confidence, 0.78x optical drift ratio).
* 🌲 **Simlipal Wildfire**: Focuses on forest canopy perimeter in Eastern Ghats (`EVT-V2-0033`, Wildfire High Priority, zero industrial context).
* ⚠️ **Single-Pass (Uncertain)**: Focuses on single-pass anomaly (`EVT-V2-0004`, 40% confidence, displaying explicit uncertainty caveats).

