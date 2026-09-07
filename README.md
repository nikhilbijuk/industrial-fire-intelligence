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

## ⚡ Quickstart: Run the Prototype

You have **Node.js v25.9.0** installed on your system. You can immediately run the end-to-end prototype on sample FIRMS data:

```bash
cd "C:\Users\Nikhil Biju\.gemini\antigravity-ide\scratch\industrial-fire-intelligence"
node prototype/thermal_events.js
```

This takes raw satellite pixel detections, clusters them into spatio-temporal events ($R \le 800\text{ m}, \Delta T \le 72\text{ h}$), checks geographic context, and outputs explainable intelligence reports with supporting and counter-evidence.
