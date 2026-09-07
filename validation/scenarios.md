# Ground-Truth Benchmark Scenarios (Phase 1)

These three concrete scenarios provide an end-to-end audit trail. The same pipeline processes raw observations from each scenario, yielding distinct, explainable conclusions.

---

## Scenario A: Persistent Industrial Thermal Source (Refinery Flare Stack)
* **Location:** IOCL Panipat Refinery Complex, Haryana ($29.4722^\circ\text{ N}, 76.8712^\circ\text{ E}$)
* **Temporal Window:** 2026-03-01 to 2026-03-03 (Continuous across 6 satellite overpasses)
* **Observed Signals:**
  - `bright_ti4`: $345\text{ K} - 356\text{ K}$
  - `frp`: $28\text{ MW} - 35\text{ MW}$ (Steady, non-exploding)
  - `daynight`: 50% Night / 50% Day passes (indicates 24/7 combustion)
  - Spatial Drift: Centroid movement $< 35\text{ m}$ across all passes
* **Contextual Association:**
  - OSM facility within $120\text{ m}$ (`landuse=industrial`, `man_made=works`)
  - ESA WorldCover: Built-up / Industrial
* **Target Classification:** `INDUSTRIAL` $\rightarrow$ `PERSISTENT_OPERATIONAL_SOURCE`
* **Confidence:** $92\%$ | **Priority:** `MEDIUM` (Operational tracking, no emergency dispatch)
* **Verifiable Evidence:** Stable physical footprint, continuous night-time combustion, high historical recurrence.

---

## Scenario B: Agricultural Stubble Burning (Seasonal Crop Clearing)
* **Location:** Sangrur District, Punjab ($30.2460^\circ\text{ N}, 75.8340^\circ\text{ E}$)
* **Temporal Window:** 2026-10-25 to 2026-10-26 (Post-monsoon Kharif harvest window)
* **Observed Signals:**
  - `bright_ti4`: $328\text{ K} - 335\text{ K}$
  - `frp`: $9\text{ MW} - 14\text{ MW}$ (Moderate heat output)
  - `daynight`: 100% Day passes (farmers ignite residue during dry daylight hours)
  - Duration: Ephemeral (dissipates within 24–48 hours)
* **Contextual Association:**
  - Zero industrial facilities within $> 8\text{ km}$
  - ESA WorldCover: Cropland (Code 40)
* **Target Classification:** `AGRICULTURAL` $\rightarrow$ `CROP_RESIDUE_BURNING`
* **Confidence:** $87\%$ | **Priority:** `LOW`
* **Verifiable Evidence:** Exclusively diurnal, short duration, cropland land-cover, no infrastructure proximity.

---

## Scenario C: Forest Canopy Wildfire (Rapid Propagation)
* **Location:** Simlipal National Park, Mayurbhanj, Odisha ($21.848^\circ\text{ N}, 86.352^\circ\text{ E}$)
* **Temporal Window:** 2026-03-12 to 2026-03-13 (Pre-monsoon dry season)
* **Observed Signals:**
  - `bright_ti4`: $358\text{ K} - 380\text{ K}$ (Rapid escalation)
  - `frp`: $45\text{ MW} \rightarrow 91\text{ MW}$ (Strong exponential surge)
  - `daynight`: Day and Night active passes
  - Spatial Drift: Centroid moved $> 1.8\text{ km}$ along valley ridgeline in 36 hours
* **Contextual Association:**
  - Protected Tiger Reserve forest reserve
  - ESA WorldCover: Tree Cover (Code 10)
* **Target Classification:** `WILDFIRE` $\rightarrow$ `FOREST_CANOPY_FIRE`
* **Confidence:** $89\%$ | **Priority:** `HIGH`
* **Verifiable Evidence:** Expanding spatial front, high FRP growth rate, continuous forest canopy, high spread velocity.
