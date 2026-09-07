# 02. SYSTEM ARCHITECTURE

## End-to-End Pipeline

```text
NASA FIRMS (NOAA-20 / NOAA-21 VIIRS streams)
       ↓
Data ingestion / validation / normalization / deduplication
       ↓
Thermal Event Construction (Spatio-Temporal Aggregation)
       ↓
Context Enrichment
├── OpenStreetMap (OSM industrial facilities & infrastructure)
├── ESA WorldCover (10m land cover raster)
├── Satellite imagery (Opportunistic Sentinel-2 SWIR / Landsat)
└── Optional weather / wind context (ERA5 / Open-Meteo)
       ↓
Feature Engineering
       ↓
Transparent Baseline Intelligence (Physics & geospatial rule scorer)
       ↓
ML Experiment / Comparison (Classical tabular: LightGBM / Random Forest)
       ↓
Evidence Engine
       ↓
Classification + Confidence + Uncertainty + Priority
       ↓
GIS Web Intelligence Dashboard
```

---

## The Thermal Event Abstraction

**CRITICAL RULE:** Do not treat each FIRMS row as an independent fire alert. Multiple satellite detections belong to one physical thermal event.

The system creates a **Thermal Event** entity containing:
- `event_id`: Unique identifier
- `first_detection`: Earliest timestamp in cluster
- `last_detection`: Most recent timestamp in cluster
- `duration`: Time span of thermal activity
- `observation_count`: Total number of sensor observations
- `active_days`: Number of unique calendar dates with thermal detections
- `centroid`: Calculated latitude/longitude center of mass
- `spatial_spread / drift`: Centroid drift across passes (stability metric)
- `frp_statistics`: Mean, maximum, and trend of Fire Radiative Power
- `brightness_temperature_statistics`: Channel 4 ($375\text{ m}$) and Channel 5 statistics
- `temporal_behaviour`: Day-to-night ratio (24/7 vs. diurnal harvest burning)
- `sensor_metadata`: Satellite provenance (NOAA-20, NOAA-21, MODIS)
- `contextual_relationships`: Proximity to mapped infrastructure and land cover type

> **Note on Thresholds:** Initial clustering thresholds such as spatial radius ($R \approx 600\text{ m} - 800\text{ m}$) and temporal window ($\Delta T \approx 72\text{ hours}$) are **HYPOTHESES**. They must be validated against real data rather than frozen prematurely.
