# 06. TEAM STRUCTURE & OWNERSHIP MATRIX

The project distributes technical responsibility across 6 CSE team members with defined module interfaces:

---

### 1. System / Product Lead (You)
- **Primary Ownership:** Overall architecture, module API/data contracts, integration, scope boundary control, demo storyline.
- **Key Deliverable:** Enforce JSON schema contracts, ensure end-to-end reproducibility, coordinate cross-module dependencies.

### 2. Backend / Data Engineering
- **Primary Ownership:** NASA FIRMS automated connector, data validation, normalization, deduplication, local spatial database (PostGIS / SQLite-SpatiaLite), REST APIs.
- **Key Deliverable:** Clean, reliable data ingestion scripts and high-speed local geospatial queries.

### 3. AI / ML Intelligence
- **Primary Ownership:** Spatio-temporal event aggregation algorithm, feature extraction pipeline, baseline scoring heuristics, ML experiments, model explainability.
- **Key Deliverable:** Feature calculation library, LightGBM/Random Forest experiments, feature attribution outputs.

### 4. GIS / Satellite
- **Primary Ownership:** OSM offline extract filtering (`landuse=industrial`), ESA WorldCover 10m raster indexing, coordinate transformations, opportunistic Sentinel-2 SWIR compositing.
- **Key Deliverable:** Sub-millisecond geographic context lookups for facility proximity and land-cover class.

### 5. Research & Validation
- **Primary Ownership:** Ground-truth curation (verified real-world case studies), literature review on sensor point spread functions (PSF), false positive analysis, confusion matrix evaluation.
- **Key Deliverable:** Independently verified benchmark dataset (`benchmark_ground_truth.csv`) and technical caveat documentation.

### 6. UI / UX + Presentation
- **Primary Ownership:** MapLibre/Leaflet geospatial intelligence dashboard, evidence inspector drawer, uncertainty visualizer, demo narrative flow.
- **Key Deliverable:** A functional, dark-mode intelligence dashboard that allows a user or judge to click any anomaly and inspect the exact "Why / Evidence / Uncertainty" breakdown.
