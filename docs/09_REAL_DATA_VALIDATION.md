# 09. REAL DATA VALIDATION (Phase 0/1 Report)

> **Dataset:** NASA FIRMS Real Near-Real-Time Active Fire Archive (VIIRS NOAA-20 & NOAA-21)  
> **Temporal Window:** 7-Day Window (Sept 1 – Sept 7, 2026)  
> **Geography:** South Asia (India Sub-Corridors: Gujarat Industrial, Punjab/Haryana Agricultural, Eastern Ghats Forest)  
> **Raw Sources Preserved Unchanged:**  
> - `prototype/data/raw/J1_VIIRS_C2_South_Asia_7d.csv` (5,352 detections)  
> - `prototype/data/raw/J2_VIIRS_C2_South_Asia_7d.csv` (4,684 detections)  
> - `prototype/data/raw/J1_VIIRS_C2_South_Asia_24h.csv` (1,288 detections)  
> - `prototype/data/raw/J2_VIIRS_C2_South_Asia_24h.csv` (690 detections)  

---

## 1. Schema & API Verification: Real NASA FIRMS vs. Initial Assumptions

Inspection of real NASA FIRMS VIIRS Collection 2 (C2) CSV outputs revealed several differences from synthetic assumptions:

| Column | Observed Format & Values | Critical Engineering Takeaway |
| :--- | :--- | :--- |
| `satellite` | `N20` and `N21` | In NASA's real C2 stream, satellite names are abbreviated (`N20` = NOAA-20, `N21` = NOAA-21). Zero Suomi-NPP (`VNP`) data was requested or used. |
| `confidence` | `nominal` (92.0%), `low` (6.9%), `high` (1.1%) | **Major Discovery:** In VIIRS, `high` confidence occurs in only 1.1% of real detections. Filtering by `confidence == 'high'` would silently discard ~99% of genuine fire events. |
| `scan` & `track` | Scan: $0.32\text{ km} - 0.80\text{ km}$<br>Track: $0.36\text{ km} - 0.78\text{ km}$ | **Pixel Distortion Confirmed:** VIIRS nadir pixels ($375\text{ m}$) expand to $800\text{ m} \times 780\text{ m}$ at the scan edge ($5.4\times$ area expansion). |
| `acq_time` | 3 to 4 digit strings (e.g. `635`, `1945`) | Must pad with leading zeros to parse ISO UTC timestamps reliably (`0635`). |
| `frp` | $0.05\text{ MW}$ to $235.55\text{ MW}$ (Mean: $4.27\text{ MW}$) | No negative or zero FRP values observed in 10,036 real detections. |
| `daynight` | `D` (46.8%) and `N` (53.2%) | Night detections actually outnumber day detections in real South Asia data. |

---

## 2. Multi-Region Real Benchmark Sample

To validate the Thermal Event Aggregator on real geography, we extracted 195 verified real detections across three distinct physical regions into `prototype/data/processed/firms_real_sample_3regions.csv`:
1. **Gujarat Industrial Corridor** ($21.0^\circ\text{N} - 23.0^\circ\text{N}, 69.0^\circ\text{E} - 73.5^\circ\text{E}$): 98 detections.
2. **Punjab/Haryana Agricultural Plain** ($29.0^\circ\text{N} - 31.5^\circ\text{N}, 74.5^\circ\text{E} - 77.0^\circ\text{E}$): 40 detections.
3. **Eastern Ghats / Odisha Forest Zone** ($18.5^\circ\text{N} - 21.5^\circ\text{N}, 82.0^\circ\text{E} - 85.0^\circ\text{E}$): 57 detections.

---

## 3. Thermal Event Aggregation Results (R = 800m, ΔT = 72h)

Running `prototype/thermal_events_real.js` against the 195 real detections produced:

- **Raw Detections Ingested:** 195
- **Physical Thermal Events Formed:** 39 (Overall compression ratio: $5:1$)
- **Single-Observation Events:** 21 ($53.8\%$)
- **Multi-Observation Events:** 18 ($46.2\%$)
- **Multi-Day Persistent Events:** 14 ($35.9\%$)

### Verified Real-World Event Highlights (Zero Mock Data)

#### 1. Hazira Industrial Belt (Surat, Gujarat) — `EVT-REAL-0001`
- **Centroid:** $[21.10491^\circ\text{N}, 72.64285^\circ\text{E}]$ (ONGC / Reliance / ArcelorMittal Hazira petrochemical complex).
- **Observations:** **52 real detections** over **7 consecutive days** ($157.0\text{ hours}$ active duration).
- **Sensors:** NOAA-20 (21) + NOAA-21 (31) interleaved.
- **Pass Distribution:** 17 Day, 35 Night ($67.3\%$ night passes — consistent with continuous industrial flaring).
- **FRP:** Mean $6.11\text{ MW}$, Max $26.51\text{ MW}$.

#### 2. IOCL Panipat Refinery Complex (Haryana) — `EVT-REAL-0026`
- **Centroid:** $[29.47559^\circ\text{N}, 76.85605^\circ\text{E}]$ (IOCL Panipat Refinery flare perimeter).
- **Observations:** **17 real detections** over **3 active days** ($73.5\text{ hours}$ duration).
- **Pass Distribution:** **17 Night passes, 0 Day passes** (Night overpasses capture the flare contrast against cooler ambient background).
- **FRP:** Mean $4.32\text{ MW}$, Max $9.46\text{ MW}$.
- **Centroid Drift:** Mean $292.6\text{ m}$, Max $631.1\text{ m}$ (within the VIIRS off-nadir pixel footprint).

#### 3. Mundra Thermal Power Complex (Kutch, Gujarat) — `EVT-REAL-0005`
- **Centroid:** $[22.93294^\circ\text{N}, 69.69835^\circ\text{E}]$ (Adani Mundra Thermal Power Plant / Port).
- **Observations:** **15 real detections** over **7 consecutive days** ($144.5\text{ hours}$ duration).
- **Pass Distribution:** 1 Day, 14 Night passes.
- **FRP:** Mean $2.49\text{ MW}$, Max $4.70\text{ MW}$ (very steady, non-exploding thermal emission).

---

## 4. Weaknesses & Edge Cases Exposed by Real Data

As mandated by our engineering methodology, we report the weaknesses exposed by real data rather than masking them:

### Weakness A: Single-Linkage "Stringing" Across Large Industrial Parks
* **What Happened:** At Hazira (`EVT-REAL-0001`), the simple proximity check grouped 52 detections spanning $1.32\text{ km}$ into one single event.
* **Why:** In large industrial complexes, multiple flare stacks sit $500\text{ m} - 800\text{ m}$ apart. A point-to-point aggregation chaining distance ($R = 800\text{ m}$) connects Stack A to Stack B, and Stack B to Stack C, creating an artificially elongated event.
* **Fix for Phase 1.1:** Transition from simple chaining to **Centroid-Constrained Aggregation** or **Density-Based Clustered Kernels** where new points must be within $R$ of the *running event centroid*, not merely any outlier point in the cluster.

### Weakness B: Off-Nadir Scan Expansion Distorts Stability Metrics
* **What Happened:** Even for a physically stationary flare stack (IOCL Panipat), the detections moved up to $631\text{ m}$ from the centroid.
* **Why:** On passes where the satellite views Panipat at nadir, pixel resolution is $375\text{ m}$. On edge passes (large scan angle), the pixel footprint expands to $800\text{ m}$, shifting the recorded pixel center by several hundred meters.
* **Fix for Phase 1.1:** Incorporate the `scan` and `track` attributes into spatial drift calculations (e.g. normalize drift by $\sqrt{\text{scan} \cdot \text{track}}$) so that off-nadir centroid shifts are not falsely penalized as moving fires.

### Weakness C: The 54% Single-Observation Noise Floor
* **What Happened:** $53.8\%$ of all detected events consisted of only 1 observation.
* **Why:** Agricultural field burns, transient small fires, and cloud-obscured single detections appear once and vanish.
* **Fix for Phase 1.1:** Explicitly partition events into two pipelines:
  - `Multi-Pass Events` (rich temporal/drift features available for deep profiling).
  - `Single-Pass Anomalies` (evaluated using spatial context and FRP alone, with attribution uncertainty flagged as `HIGH`).
