# 01. MASTER CONTEXT

**Project:** Industrial Fire Intelligence  
**Problem Statement:** SIH26162 — AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data.  
**Theme:** Disaster Management  
**Organization:** National Technical Research Organisation (NTRO)  

---

## Core Idea
A satellite detects a thermal anomaly. We do not simply show “fire detected”. We investigate what that thermal anomaly is likely to represent.

## Core Pipeline
```text
THERMAL ANOMALY → CONTEXT → INTELLIGENCE → EXPLANATION → ACTION
```

The system classifies a thermal event into categories such as:
- Industrial fire
- Persistent industrial heat / flare
- Agricultural burning
- Wildfire
- Other thermal anomaly
- Unknown

---

## Important Philosophy: "Small Project in a Big Way"
We want a small, technically defensible system with:
- Real NASA FIRMS data
- Strong geospatial reasoning
- Meaningful AI/ML only where justified
- Explainable results
- Explicit uncertainty communication
- Reliable engineering
- Excellent UX
- One memorable demo

We do **NOT** want:
- AI for AI’s sake
- A generic fire detection dashboard
- A huge, bloated platform
- Fake / arbitrary confidence scores
- Unsupported claims
- CNN / LLM just for presentation
- Dozens of disconnected, half-baked features

---

## Core Differentiator
NASA FIRMS already tells us that a thermal anomaly exists. Our system asks:  
> **“What is this thermal anomaly likely to represent, and what evidence supports that conclusion?”**

---

## Important Scientific Constraints
- **FIRMS is not ground truth:** A thermal anomaly is not automatically a confirmed fire.
- **Pixel resolution limits attribution:** At VIIRS $375\text{ m} - 800\text{ m}$ pixel scale, do not claim exact sub-meter facility attribution.
- **OSM absence $\neq$ facility absence:** Never assume an area has no industrial facility merely because OpenStreetMap lacks a tag.
- **Cloud cover:** Optical and thermal sensors can be blinded by meteorological cloud cover.
- **Confidence:** Must be evidence-based and calibrated, never invented percentages.

---

## Preferred System Output
> **Potential Industrial Fire**  
> Confidence: [validated/calibrated value]  
> 
> **Why? (Supporting Evidence):**  
> • Nearby industrial facility  
> • Unusual thermal behaviour  
> • Intensity / FRP pattern  
> • Historical persistence / sudden change  
> • Land-use / environmental context  
> • Satellite evidence where available  
> 
> **Counter-Evidence:**  
> • Vegetation / fire indicators  
> • Cloud limitations  
> • Weak facility association  
> • Insufficient observations  
> 
> **Uncertainty:**  
> Clearly explain what the system cannot determine.

---

## MVP Scope Boundary
1. Select a FIRMS thermal anomaly/event.
2. Build a thermal event from related spatio-temporal observations.
3. Enrich it with geographic/contextual information.
4. Classify what the event is likely to represent.
5. Show supporting and counter-evidence.
6. Show confidence and uncertainty.
7. Show everything clearly on a GIS dashboard.

*Do NOT expand the MVP unless there is a strong technical reason.*
