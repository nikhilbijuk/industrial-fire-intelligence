# 13. TECHNICAL SPECIFICATION

**Project:** Industrial Fire Intelligence  
**Problem Statement ID:** SIH26162  
**Organization:** National Technical Research Organisation (NTRO)  
**Theme:** Disaster Management | **Category:** Software  
**Document Version:** 2.1.0 (Phase 2 Real-Data Production Freeze)  
**Security / Operational Classification:** Unclassified / Technical Reference  

---

## 1. Executive Summary & Problem Scope

### 1.1 Objective
Satellite earth-observation systems (e.g., NASA FIRMS VIIRS/MODIS) detect thermal anomalies in real time, but generate raw coordinates that cannot distinguish between routine industrial combustion (flare stacks, kiln operations, smelters), forest wildfires, agricultural stubble burning, or sensor false alarms.

**Industrial Fire Intelligence** is a contextual intelligence engine operating post-detection. It aggregates raw thermal detections into coherent spatio-temporal **thermal events**, evaluates satellite viewing geometry, associates events with ground infrastructure via geodesic metric analysis, and delivers an **explainable evidence breakdown with calibrated uncertainty**.

```text
RAW SATELLITE ANOMALY (FIRMS)
             ↓
SPATIO-TEMPORAL AGGREGATOR V2 (Centroid-Constrained + Parallax Compensated)
             ↓
GEOMETRIC DIAGNOSTICS (Normalized Optical Drift Ratio)
             ↓
GEODESIC FACILITY ASSOCIATION (OSM Industrial Infrastructure)
             ↓
EXPLAINABLE EVIDENCE & UNCERTAINTY SCORER
             ↓
AIR-GAPPED OPERATIONAL GIS DASHBOARD
```

---

## 2. System Architecture & Component Specification

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INGESTION & DATA LAYER                          │
├──────────────────────────────────┬─────────────────────────────────────┤
│ NASA FIRMS VIIRS (375m)          │ OpenStreetMap (OSM) Infrastructure   │
│ - NOAA-20 & NOAA-21              │ - industrial=refinery, steel_mill,  │
│ - Latitude, Longitude, FRP, Scan │   power_plant, chemical             │
│ - Brightness Ti4, Track, Day/Night│ - Landuse & Man-made tags           │
└─────────────────┬────────────────┴──────────────────┬──────────────────┘
                  │                                   │
┌─────────────────▼───────────────────────────────────▼──────────────────┐
│                      CORE ANALYTIC ENGINE (Node.js)                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Spatio-Temporal Aggregator V2                                       │
│    - Running centroid incremental update                               │
│    - Dynamic footprint expansion scaling (scan × track)                │
│    - Explicit single-pass vs. multi-pass branching                     │
│                                                                        │
│ 2. Sensor Geometry & Spatial Drift Engine                              │
│    - Computes Normalized Optical Drift Ratio                           │
│    - Flags stationary point sources vs. propagating perimeters         │
│                                                                        │
│ 3. Geodesic Metric Spatial Association                                 │
│    - WGS84 Haversine metric proximity search (<2,000m threshold)       │
│                                                                        │
│ 4. Calibrated Multi-Factor Evidence Scorer                             │
│    - Explicit supporting factors (+weights)                            │
│    - Explicit counter-evidence & conflict penalties (-weights)         │
│    - Scientific caveats & uncertainty bounds (High/Med/Low)            │
└─────────────────┬──────────────────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────────────────┐
│                    AIR-GAPPED OPERATIONAL DASHBOARD                    │
├────────────────────────────────────────────────────────────────────────┤
│ - Client-side Leaflet (100% bundled offline vendor files)              │
│ - High-contrast tactical GIS radar display                             │
│ - Zero external network calls; zero telemetry; air-gap compliant       │
│ - Interactive Evidence Inspector Drawer with Satellite Pass Timeline   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical & Algorithmic Formulation

### 3.1 Centroid-Constrained Spatio-Temporal Clustering
To prevent the single-linkage stringing flaw (where Stack A links to Stack B across miles into an amorphous blob), detection $P_i$ is absorbed into Cluster $C_k$ if and only if:

$$\text{dist}(P_i, \text{Centroid}_k) \le R_{\text{effective}}$$

$$\Delta T = |T(P_i) - T_{\text{last}}(C_k)| \le 72\text{ hours}$$

The cluster centroid is updated incrementally with each absorbed observation:

$$\text{Centroid}_{N+1} = \frac{N \cdot \text{Centroid}_N + P_i}{N + 1}$$

### 3.2 Dynamic Footprint Scaling (Scan/Track Parallax Compensation)
At extreme satellite viewing angles (off-nadir), the VIIRS pixel footprint stretches from $375\text{ m} \times 375\text{ m}$ up to $\sim 800\text{ m} \times 800\text{ m}$ (a $4.5\times$ area increase). The allowable cluster radius scales dynamically:

$$R_{\text{effective}} = R_{\text{base}} \times \min\left(2.2, \max\left(1.0, \sqrt{\frac{\text{scan}_i \times \text{track}_i}{\text{nadir\_area}}}\right)\right)$$

*Where $R_{\text{base}} = 750\text{ m}$, $\text{nadir\_area} = 0.375 \times 0.375 = 0.140625\text{ km}^2$.*

### 3.3 Normalized Optical Drift Ratio
To prevent false fire-spread alerts caused purely by satellite pixel elongation, the system computes the Normalized Optical Drift Ratio:

$$\text{Ratio}_{\text{drift}} = \frac{1}{N}\sum_{i=1}^N \frac{\text{dist}(P_i, \text{Centroid})}{r_{\text{footprint}}(P_i)}$$

Where the sensor footprint radius is:

$$r_{\text{footprint}}(P_i) = \frac{1}{2}\sqrt{\text{scan}_i^2 + \text{track}_i^2} \times 1000\text{ m}$$

* **$\text{Ratio} \le 1.0$:** Coordinate shifts are fully accounted for by satellite optical footprint expansion $\rightarrow$ **Stationary Point Source (Consistent with flare/chimney)**.
* **$1.0 < \text{Ratio} \le 1.6$:** Moderate dispersion (consistent with multi-stack complex or small local spread).
* **$\text{Ratio} > 1.6$:** Coordinate displacement significantly exceeds sensor footprint bounds $\rightarrow$ **Physical Perimeter Propagation (Wildfire/Fire Front)**.

### 3.4 Geodesic Metric Distance (WGS84 Haversine)
Proximity between event centroid $(\phi_1, \lambda_1)$ and industrial infrastructure $(\phi_2, \lambda_2)$ is computed over the mean earth radius ($R = 6,371,000\text{ m}$):

$$\Delta \phi = \phi_2 - \phi_1, \quad \Delta \lambda = \lambda_2 - \lambda_1$$

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$d = 2R \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$

---

## 4. Classification Taxonomy & Decision Engine

The engine categorizes events into four distinct domains using transparent, auditable multi-factor evidence weighting:

| Classification Domain | Subclass | Typical Confidence | Key Criteria |
| :--- | :--- | :---: | :--- |
| **`INDUSTRIAL`** | `PERSISTENT_OPERATIONAL_SOURCE` | $0.85 - 0.95$ | $d \le 1500\text{m}$ to industrial facility, multi-day persistence ($\ge 3$ days), optical drift $\le 1.0$, high night-ratio ($\ge 0.50$). |
| **`INDUSTRIAL`** | `ABNORMAL_INDUSTRIAL_EVENT` | $0.75 - 0.88$ | $d \le 1500\text{m}$, sudden FRP surge ($>3\times$ baseline mean), optical drift $>1.0$. |
| **`WILDFIRE`** | `FOREST_CANOPY_FIRE` | $0.80 - 0.92$ | Forest reserve context, $d > 10\text{km}$ from industrial facilities, expanding front ($\text{Ratio} > 1.2$). |
| **`AGRICULTURAL`** | `CROP_RESIDUE_BURNING` | $0.75 - 0.88$ | Rural plain context, daylight restricted (night ratio $<0.20$), short duration ($\le 24\text{h}$). |
| **`OTHER`** | `SINGLE_PASS_ANOMALY` | $0.35 - 0.45$ | Single satellite observation ($N=1$). Explicitly constrained to **LOW confidence** with mandatory uncertainty warnings. |

### 4.1 Evidence Scoring Formula
The final confidence score $C$ is a calibrated, additive weight model bounded between $[0.10, 0.95]$:

$$C = \text{clamp}\left(C_{\text{base}} + \sum w_{\text{support}} + \sum w_{\text{counter}}, 0.10, 0.95\right)$$

* **Industrial Infrastructure Association:** $+0.35$ ($d < 800\text{m}$) or $+0.25$ ($d < 1500\text{m}$)
* **Multi-Day Persistence:** $+0.25$ ($\ge 3$ calendar days)
* **Stationary Footprint Consistency:** $+0.25$ ($\text{Ratio}_{\text{drift}} \le 1.0$)
* **Continuous 24/7 Combustion:** $+0.15$ (Night ratio $\ge 0.50$)
* **Industrial Facility Absence:** $-0.20$ ($d > 2000\text{m}$)

---

## 5. Data Contracts & Schema Specification

All pipeline outputs conform to the locked JSON schema defined in `schemas/event_intelligence.json`.

### 5.1 Standardized Event Object
```json
{
  "event_id": "EVT-V2-0007",
  "event_type": "MULTI_PASS_TRACKED_EVENT",
  "region": "gujarat_industrial",
  "spatio_temporal": {
    "centroid": { "latitude": 21.10554, "longitude": 72.64656 },
    "observation_count": 31,
    "active_days": 7,
    "duration_hours": 144.5,
    "first_detected": "2026-08-31T20:59:00.000Z",
    "last_detected": "2026-09-06T21:31:00.000Z",
    "day_night": { "day": 9, "night": 22 },
    "night_ratio": 0.71
  },
  "spatial_diagnostics": {
    "raw_max_drift_meters": 685.5,
    "raw_mean_drift_meters": 297.6,
    "normalized_optical_drift_ratio": 0.85,
    "spatial_consistency": "STATIONARY_POINT_SOURCE"
  },
  "thermal_diagnostics": {
    "min_frp_mw": 1.48,
    "mean_frp_mw": 5.94,
    "max_frp_mw": 26.51
  },
  "context": {
    "nearest_facility_name": "ArcelorMittal Nippon Steel India",
    "nearest_facility_type": "steel_mill",
    "operator": "ArcelorMittal Nippon Steel India",
    "geodesic_distance_meters": 563,
    "facility_coordinates": [21.1098624, 72.6437334]
  },
  "classification": {
    "domain": "INDUSTRIAL",
    "subclass": "PERSISTENT_OPERATIONAL_SOURCE",
    "confidence_label": "HIGH",
    "confidence_score": 0.91
  },
  "evidence_breakdown": {
    "supporting_evidence": [
      { "factor": "Industrial Infrastructure Proximity", "description": "Event centroid is 563m from real OSM facility: ArcelorMittal Nippon Steel India (steel_mill)", "weight": 0.35 },
      { "factor": "Multi-Day Temporal Persistence", "description": "Recurrent thermal detections observed across 7 separate calendar days (144.5h duration)", "weight": 0.25 },
      { "factor": "Stationary Footprint Consistency", "description": "Normalized optical drift ratio is 0.85 (<= 1.0); observed coordinate displacement is within the estimated sensor pixel footprint, consistent with a stationary source", "weight": 0.25 },
      { "factor": "Continuous 24/7 Combustion", "description": "71% of detections occurred during night overpasses, consistent with continuous industrial operations", "weight": 0.15 }
    ],
    "counter_evidence": []
  },
  "uncertainty": {
    "level": "MODERATE",
    "caveats": [
      "FIRMS detects a thermal anomaly; proximity does not constitute proof of facility-level attribution.",
      "At VIIRS 375m-800m pixel footprint, detection represents high-probability spatial association."
    ]
  },
  "priority": "MEDIUM"
}
```

---

## 6. Deployment & Air-Gapped Operational Constraints

### 6.1 Hardware & Environment Requirements
* **OS:** Cross-platform (Windows 10/11, Ubuntu 20.04+, macOS 12+).
* **Runtime:** Node.js v18+ (verified on Node.js v25.9.0).
* **Dependencies:** Zero external npm packages required for runtime (`server.js` uses native `http`, `fs`, `path`).
* **RAM:** $<150\text{ MB}$ total runtime memory footprint.
* **Storage:** $<5\text{ MB}$ complete repository size (code, real datasets, bundled leaflet vendor library).

### 6.2 Air-Gapped Security & Sovereign Execution
* **Zero External HTTP Calls:** All demo datasets, OSM facilities, and client-side map libraries are bundled locally in `data_bundle.js` and `vendor/leaflet/`.
* **Zero Telemetry / Analytics:** No telemetry, tracking scripts, or cloud phone-home mechanisms exist in the codebase.
* **Network Isolation:** Runs with 100% functionality on hardware with all network adapters disabled (airplane mode).

---

## 7. Verification & Benchmarking Matrix

The system has been evaluated against 195 real NASA VIIRS detections across three diverse Indian geographic sectors:

| Benchmark Region | Environment | Detections | Aggregated Events | Primary Benchmark Event | Resulting Classification | Proximity & Evidence |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **Hazira, Gujarat** | Petrochemical & Steel Corridor | 59 | 10 | `EVT-V2-0007` | `INDUSTRIAL` (Persistent Source) | 563m to AM/NS Steel Mill; 7 days active; 0.85x drift ratio. |
| **Panipat, Haryana** | Refinery & Petrochemical Complex | 67 | 15 | `EVT-V2-0027` | `INDUSTRIAL` (Persistent Source) | 1,107m to IOCL Refinery Unit; 100% night passes; 0.78x drift ratio. |
| **Simlipal / Angul, Odisha** | Deciduous Forest Reserve & Mining | 69 | 16 | `EVT-V2-0033` | `WILDFIRE` (Forest Canopy Fire) | Forest reserve biome; 0 industrial units; spreading fire perimeter. |

---

## 8. Summary of Technical Innovations

1. **Physical Footprint Parallax Correction:** Eliminates false fire movement caused by VIIRS off-nadir pixel stretching.
2. **Explainable Multi-Factor Scoring:** Replaces black-box ML with an auditable, weight-driven evidence drawer tailored for intelligence operators.
3. **Scientifically Honest Calibrated Uncertainty:** Explicitly tags single-pass anomalies with low confidence and mandatory caveats rather than hallucinating confident classifications.
4. **Resilient Air-Gap Architecture:** 1-click execution on any commodity machine without cloud, database, or internet dependencies.
