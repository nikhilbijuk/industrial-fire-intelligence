# 07. IMMEDIATE PLAN & EXECUTION ROADMAP

## Strict Engineering Order of Operations

```text
Phase 0: Feasibility (Verify real FIRMS & OSM data, rate limits, schema)
       ↓
Phase 1: Thermal Event Engine (Aggregate raw FIRMS rows into physical events)
       ↓
Phase 2: Context Engine (Enrich with OSM facilities & WorldCover raster)
       ↓
Phase 3: Intelligence v1 (Deterministic Evidence & Heuristic Scoring baseline)
       ↓
Phase 4: Validation Benchmark (Curate 30-40 independently verified test cases)
       ↓
Phase 5: ML Experiments (Only if independent ground truth justifies it)
       ↓
Phase 6: Evidence Engine (Export classification, evidence weights, uncertainty)
       ↓
Phase 7: GIS Intelligence Dashboard (Map visualization + Evidence inspector)
       ↓
Phase 8: High-Impact Demo (3 contrasting investigation scenarios)
```

---

## 🚫 What NOT to Build at Inception
- ❌ Fancy React dashboard with animated particles
- ❌ User login / authentication / permissions
- ❌ Heavy cloud deployments, Kubernetes, or complex Docker setups
- ❌ Complex deep learning (CNNs, Vision Transformers, LLM chatbots)
- ❌ 36-event benchmark on Day 1 (focus on 3 gold-standard scenarios first)
- ❌ Automated heavy satellite image downloading pipeline

---

## 🎯 First Solo Session Deliverables (Completed)
1. ✅ **Inspect real FIRMS data:** Built and verified `prototype/firms_sample.csv`.
2. ✅ **Build first thermal-event prototype:** Implemented `prototype/thermal_events.py` and `prototype/thermal_events.js`.
3. ✅ **Define data/evidence contracts:** Formalized `schemas/event_intelligence.json`.
4. ✅ **Create 3 concrete investigation scenarios:** Documented in `validation/scenarios.md`.
5. ✅ **Package findings for team:** Established repository structure and handoff docs.
