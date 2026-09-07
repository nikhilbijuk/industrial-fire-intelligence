# 04. CLASSIFICATION APPROACH

## Hierarchical Reasoning Architecture
Do not immediately build a flat six-class black-box model. Segregation operates hierarchically:

### LEVEL 1: Environmental Domain Segregation
- **Industrial / Anthropogenic**
- **Vegetation / Agricultural**
- **Natural / Wildfire**
- **Other / Unknown**

### LEVEL 2: Behavioral & Operational Sub-Classification
- **Industrial:**
  - *Persistent Industrial Heat / Operational Flare Stack* (continuous, stable centroid)
  - *Potential Abnormal Industrial Event / Facility Fire* (FRP surge, spatial spread)
- **Vegetation:**
  - *Agricultural Burning* (diurnal, short-lived, cropland)
  - *Wildfire* (rapid directional spread, forest/grassland canopy)
- **Other:**
  - *Other Thermal Anomaly*
  - *Unknown / Unclassified*

### Rationale
- **Industrial vs. Vegetation/Natural** is primarily a *geographic and contextual* problem.
- **Persistent Flare vs. Abnormal Industrial Fire** is primarily a *temporal and behavioral anomaly* problem.

---

## Feature Vector Specification

### 1. Temporal Features
- `observation_count`: Total detections in cluster
- `active_days`: Unique days of activity
- `duration_hours`: Duration from first to last detection
- `persistence_score`: Recurrence frequency over 30/60/90-day window
- `observation_gaps`: Time intervals between detections
- `day_night_ratio`: Ratio of night detections to total (flares burn 24/7; agriculture is daytime)

### 2. Thermal Features
- `mean_frp`, `max_frp`: Fire Radiative Power metrics (MW)
- `frp_trend`: Baseline deviation ($Z$-score relative to location history)
- `bright_ti4_mean`: VIIRS I4 channel ($375\text{ m}$ MIR) brightness temperature
- `bright_ti5_mean`: VIIRS I5 channel ($375\text{ m}$ TIR) brightness temperature
- `detection_confidence`: Sensor-assigned confidence distribution

### 3. Spatial Features
- `cluster_radius`: Bounding footprint
- `centroid_stability`: Standard deviation of detection distance to centroid
- `spatial_drift_velocity`: Rate of centroid movement over time (km/day)

### 4. Contextual Features
- `facility_distance`: Distance to nearest industrial facility polygon (meters)
- `facility_type`: Tags (`refinery`, `power_plant`, `steel_mill`, `chemical`)
- `landcover_class`: ESA WorldCover 10m class (Built-up, Cropland, Tree cover)
- `infrastructure_density`: Nearby roads, rail, and settlements

### 5. Satellite Corroboration Features
- `cloud_fraction`: Cloud obscuration index over event window
- `vegetation_index`: Pre/post NDVI or SWIR burn reflectance when cloud-free
