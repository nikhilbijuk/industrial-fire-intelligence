# Project: Industrial Fire Intelligence (SIH26162)

## 1. Problem Statement
Given a satellite-detected thermal anomaly (NASA FIRMS), determine whether its spatial, temporal, thermal, and environmental context is consistent with an industrial source, persistent flare, agricultural burning, wildfire, or other thermal source — and present the verifiable evidence and uncertainty behind that determination.

## 2. Core Operational Transformation
```text
SATELLITE THERMAL ANOMALY (FIRMS pixel centroid)
       ↓
SPATIO-TEMPORAL AGGREGATION (Thermal Event: R ~ 600m, ΔT ~ 72h)
       ↓
CONTEXTUAL ENRICHMENT (OSM Industrial Proximity + ESA WorldCover 10m)
       ↓
EVIDENCE ENGINE (Deterministic physics & spatial scoring + baseline ML)
       ↓
EXPLAINABLE OUTPUT (Classification + Confidence + Evidence + Counter-Evidence + Priority)
```

## 3. Target Classification Taxonomy
We evaluate anomalies hierarchically:
- **Level 1 — Environmental Domain:**
  - `INDUSTRIAL_ANTHROPOGENIC` (Built-up, industrial polygons, infrastructure proximity < 1000m)
  - `AGRICULTURAL` (Cropland, short-lived, seasonal clusters, low spatial stability)
  - `WILDFIRE` (Forest/shrubland, high spatial expansion velocity, rapid growth)
  - `OTHER_UNKNOWN` (Isolated detections, low confidence, water glint, ambiguous context)
- **Level 2 — Industrial Sub-Classification:**
  - `PERSISTENT_OPERATIONAL_SOURCE` (Recurrent multi-day flare/furnace, stable centroid < 75m, steady FRP)
  - `ABNORMAL_INDUSTRIAL_FIRE` (Sudden FRP spike > 3x baseline, expanding footprint, transient emergency)

## 4. Input & Output Contracts
- **Input:** NASA FIRMS NRT active fire stream (VIIRS NOAA-20/21: `latitude`, `longitude`, `bright_ti4`, `bright_ti5`, `frp`, `confidence`, `acq_date`, `acq_time`, `daynight`).
- **Output:** Structured JSON Evidence Object detailing classification, confidence (0.0–1.0), positive/negative evidence factors, attribution uncertainty, and risk priority.

## 5. Explicit Non-Goals (Scope Boundaries)
- ❌ NOT detecting fires from raw satellite imagery from scratch (FIRMS is detection; we are intelligence).
- ❌ NOT claiming sub-meter facility attribution when VIIRS pixel is 375m–800m.
- ❌ NOT real-time drone control or automated emergency dispatch.
- ❌ NOT full global real-time monitoring (focus on target industrial and high-risk regional corridors).
- ❌ NOT building a generic LLM chatbot (every conclusion must be backed by verifiable geospatial evidence).
