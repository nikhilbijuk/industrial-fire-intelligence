# 11. PHASE 2: REAL OSM INDUSTRIAL CONTEXT & GEODESIC EVIDENCE

> **Objective:** Benchmark-first OpenStreetMap (OSM) extraction and true spherical geodesic distance matching for the 3 demo regions (Hazira, Panipat, Eastern Ghats).  
> **Source Files:**  
> - `prototype/osm_fetch.js` (Cached Overpass extraction to disk)  
> - `prototype/data/raw/osm_*.json` (41 Hazira, 30 Panipat, 23 Simlipal elements)  
> - `prototype/data/processed/osm_real_facilities.json` (94 normalized real facilities)  
> - `prototype/process_osm_facilities.js` (Geodesic matching engine)  
> - `prototype/data/processed/final_event_intelligence.json` (Final enriched dataset)  

---

## 1. Scientific & Geospatial Corrections Applied

### A. True Spherical Geodesic Distances (Eliminating Degree-to-Meter Fallacy)
* Naive bounding-box checks like $\text{ST\_DWithin}(..., 0.02^\circ)$ treat degrees as constants. However, at $29.4^\circ\text{ N}$ (Panipat), $1^\circ$ of longitude equals $\approx 96.8\text{ km}$, while at $21.1^\circ\text{ N}$ (Hazira), it equals $\approx 103.7\text{ km}$.
* We replaced all planar/degree approximations with **Haversine great-circle metric distances**:
  $$d = 2 R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$
  Where $R = 6{,}371{,}000\text{ m}$. All facility associations are measured strictly in metric meters.

### B. Scientifically Defensible Optical Ratio Wording
* **Old Draft Claim:** *"Drift ratio $\le 1.0$ mathematically proves the physical source cannot have moved."* (Scientifically indefensible).
* **Corrected Defense:** *"Normalized optical drift ratio is $\le 1.0$; observed coordinate displacement is within the estimated sensor pixel footprint, consistent with a stationary source."*

### C. Explicit Attribution Uncertainty Caveats
* Every industrial association carries explicit caveats in the data contract:
  - *“FIRMS detects a thermal anomaly; proximity alone does not constitute proof of facility-level attribution.”*
  - *“At VIIRS $375\text{ m} - 800\text{ m}$ pixel footprint, detection represents high-probability spatial association rather than sub-meter stack attribution.”*

---

## 2. Real OSM Facility Extraction Summary

| Demo Region | Overpass Query Bounding Box | Elements Retrieved | Key Normalized Facilities |
| :--- | :--- | :---: | :--- |
| **Hazira Industrial Corridor** | $[21.05, 72.60, 21.20, 72.75]$ | 41 | • ArcelorMittal Nippon Steel India ($[21.1098, 72.6437]$)<br>• Hazira II Power Plant ($[21.1195, 72.6401]$)<br>• Shell Energy LNG Terminal ($[21.0972, 72.6214]$) |
| **Panipat Industrial Hub** | $[29.40, 76.80, 29.55, 76.95]$ | 30 | • Panipat Refinery Complex ($[29.4749, 76.8908]$)<br>• IOCL Captive Power Plant ($[29.4675, 76.8755]$)<br>• Naphtha Cracker Units ($[29.4557, 76.8597]$) |
| **Eastern Ghats / Odisha** | $[20.75, 84.90, 21.05, 85.20]$ | 23 | • Simlipal National Park / Tiger Reserve perimeters<br>• Forest mountain ridges (zero industrial plants) |

---

## 3. Results Across All 41 Real Thermal Events

| Domain Classification | Event Count | Percentage | Physical Interpretation |
| :--- | :---: | :---: | :--- |
| **INDUSTRIAL** | 9 | $22.0\%$ | Within $500\text{ m} - 1500\text{ m}$ of real steel mills, refineries, and power complexes. |
| **AGRICULTURAL** | 12 | $29.3\%$ | Located in open croplands $> 30\text{ km}$ from industry, $100\%$ daylight passes. |
| **WILDFIRE** | 2 | $4.9\%$ | Situated in protected mountain forest canopy, expanding fire perimeter, overnight burns. |
| **OTHER (Single-Pass)** | 18 | $43.9\%$ | Isolated single observations. Drift/persistence disabled; uncertainty flagged as `HIGH`. |

---

## 4. The 3 Wednesday Demo Showcases (Pre-Cached & Crash-Proof)

### Showcase 1: Hazira Petrochemical Flare (`EVT-V2-0007`)
* **Centroid:** $[21.10554^\circ\text{N}, 72.64656^\circ\text{E}]$
* **Nearest OSM Facility:** *ArcelorMittal Nippon Steel India* ($563\text{ m}$ away)
* **Thermal History:** 31 satellite observations across 7 consecutive days ($144.5\text{ h}$ duration).
* **Optical Ratio:** **$0.85$** (within sensor pixel footprint).
* **Night Ratio:** **$71\%$** night passes (continuous 24/7 combustion).
* **Classification:** `INDUSTRIAL` $\rightarrow$ `PERSISTENT_OPERATIONAL_SOURCE` (Confidence: `HIGH`, Priority: `MEDIUM`).

### Showcase 2: IOCL Panipat Refinery Flare (`EVT-V2-0027`)
* **Centroid:** $[29.47559^\circ\text{N}, 76.85605^\circ\text{E}]$
* **Nearest OSM Facility:** *Panipat Refinery Complex* ($1{,}107\text{ m}$ away)
* **Thermal History:** 17 observations across 3 active days ($100\%$ night passes).
* **Optical Ratio:** **$0.78$** (within sensor pixel footprint).
* **Classification:** `INDUSTRIAL` $\rightarrow$ `PERSISTENT_OPERATIONAL_SOURCE` (Confidence: `HIGH`, Priority: `MEDIUM`).

### Showcase 3: Odisha Mountain Wildfire (`EVT-V2-0033`)
* **Centroid:** $[19.10122^\circ\text{N}, 82.16614^\circ\text{E}]$
* **Context:** Forested mountain corridor in Eastern Ghats.
* **Nearest Industrial Facility:** **$355\text{ km}$ away** (Zero industrial infrastructure).
* **Thermal History:** 18 observations across 4 active days.
* **Spatial Spread:** $553.6\text{ m}$ perimeter drift. Night passes present ($89\%$).
* **Classification:** `WILDFIRE` $\rightarrow$ `FOREST_CANOPY_FIRE` (Confidence: `HIGH`, Priority: `HIGH`).
