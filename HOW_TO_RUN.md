# How to Run on Any PC (After Downloading the ZIP)

This project is built to run **100% locally and offline** with zero external dependencies, no database setup, and no npm installs needed.

---

## 🚀 Running the System

### Option 1: 1-Click Launch (Recommended for Windows)
1. Extract the downloaded ZIP file.
2. Double-click **`start_dashboard.bat`** in the project root.
3. It automatically starts the local zero-dependency server and launches `http://localhost:3000` in your default browser.

---

### Option 2: Terminal Command (PowerShell / Command Prompt / Mac / Linux)
1. Open PowerShell, Command Prompt, or Terminal inside the extracted project folder.
2. Run:
   ```bash
   node dashboard/server.js
   ```
3. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

### Option 3: Direct File Open (Zero-Server Offline Fallback)
If Node.js is not installed on the presenting machine:
1. Double-click **`dashboard/index.html`** directly in any browser (Chrome, Edge, Firefox).
2. The pre-compiled data bundle (`dashboard/data_bundle.js`) and bundled Leaflet vendor files will load all 41 real satellite thermal events, OSM facilities, and evidence cards without needing a web server or internet connection.

---

## 🎯 Verifying the Rehearsed Demo Scenarios

Once the dashboard is open at `http://localhost:3000`, click the 4 scenario buttons in the top navigation bar to demonstrate the satellite intelligence pipeline:

1. 🏭 **Hazira Petrochem Flare** (`btn-demo-hazira`)
   - **Target Event:** `EVT-V2-0007` (Gujarat Industrial Belt)
   - **Intelligence Output:** Persistent Operational Source (91% Confidence, High Priority)
   - **Key Evidence:** Centroid is **563m** from real OSM facility (*ArcelorMittal Nippon Steel India*), **7-day** multi-pass persistence (31 satellite passes), **0.85x** normalized optical drift ratio (consistent with stationary flame footprint).

2. ⛽ **Panipat Refinery** (`btn-demo-panipat`)
   - **Target Event:** `EVT-V2-0027` (Punjab/Haryana Border)
   - **Intelligence Output:** Persistent Operational Source (91% Confidence, High Priority)
   - **Key Evidence:** Located **1,107m** from real OSM refinery unit, 100% night detections (24/7 industrial activity), **0.78x** optical drift ratio.

3. 🌲 **Simlipal Wildfire** (`btn-demo-forest`)
   - **Target Event:** `EVT-V2-0033` (Eastern Ghats Forest Corridor)
   - **Intelligence Output:** Forest Canopy Fire (89% Confidence, Wildfire High Priority)
   - **Key Evidence:** Sits inside designated Forest Reserve biome, zero industrial infrastructure recorded within 350+ km, expanding fire front perimeter.

4. ⚠️ **Single-Pass (Uncertain)** (`btn-demo-anomaly`)
   - **Target Event:** `EVT-V2-0004`
   - **Intelligence Output:** Single-Pass Anomaly (40% Calibrated Confidence, Explicit Caveats)
   - **Key Evidence:** Explicitly flags insufficient temporal observations. Displays scientific caveats warning that a single detection cannot establish persistence or spread.

---

## 📁 Key Documentation References
- **Judge Defense & Pitch Script:** `docs/12_JUDGE_DEFENSE_AND_DEMO_SCRIPT.md`
- **Spatio-Temporal Aggregator V2:** `docs/10_EVENT_AGGREGATION_V2.md`
- **OSM Geodesic Association:** `docs/11_PHASE2_OSM_INTELLIGENCE.md`
