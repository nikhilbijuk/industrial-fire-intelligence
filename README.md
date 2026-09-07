# Industrial Fire Intelligence (SIH26162)

> **Official Problem Statement:** AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data  
> **Theme:** Disaster Management | **Category:** Software | **Organization:** National Technical Research Organisation (NTRO)  
> **Core Principle:** *"A satellite detects a thermal anomaly. We don't simply show 'fire detected' — we investigate what that thermal anomaly is likely to represent."*

---

## 🧭 Repository Structure

```text
industrial-fire-intelligence/
├── README.md                           <- Master Overview & Quickstart
├── docs/
│   ├── 01_MASTER_CONTEXT.md            <- Problem definition, philosophy, and constraints
│   ├── 02_ARCHITECTURE.md              <- System pipeline, spatio-temporal event model
│   ├── 03_DATA_SOURCES.md              <- NASA FIRMS, OSM, WorldCover, Sentinel-2 analysis
│   ├── 04_CLASSIFICATION_APPROACH.md   <- Hierarchical taxonomy & feature definitions
│   ├── 05_ML_RULE.md                   <- Baseline first, anti-leakage, evaluation rules
│   ├── 06_TEAM_STRUCTURE.md            <- 6-person CSE responsibility matrix
│   ├── 07_IMMEDIATE_PLAN.md            <- Phase-by-phase execution order
│   └── 08_NORTH_STAR.md                <- Advisory principles & technical guardrails
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

## ⚡ Quickstart: Launch the Dashboard

Run the offline dashboard on any machine with Node.js installed:

```bash
# 1. Clone the repository
git clone https://github.com/nikhilbijuk/industrial-fire-intelligence.git
cd industrial-fire-intelligence

# 2. Start the zero-dependency local dashboard server
node dashboard/server.js

# 3. Open in your browser:
http://localhost:3000
```

This runs the interactive GIS console evaluating real satellite detections against industrial facilities with explainable evidence breakdowns.
