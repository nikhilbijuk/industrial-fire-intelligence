/**
 * Industrial Fire Intelligence - Web Dashboard Controller
 * Connects pre-processed V2 Thermal Events and Real OSM Facilities with Leaflet map
 * and populates the Explainable Evidence Inspector Drawer.
 * 100% Client-side, zero live external API calls.
 */

let map = null;
let eventMarkers = [];
let facilityLayers = [];
let allEvents = [];
let allFacilities = [];

// Ensure datasets are loaded immediately from window if precomputed bundle is loaded
function ensureDatasetsLoaded() {
  if (allEvents.length === 0 && window.PRECOMPUTED_EVENTS) {
    allEvents = window.PRECOMPUTED_EVENTS;
  }
  if (allFacilities.length === 0 && window.PRECOMPUTED_FACILITIES) {
    allFacilities = window.PRECOMPUTED_FACILITIES;
  }
}

// Global click handler accessible directly via HTML onclick or JavaScript event listeners
window.handleDemoClick = function(scenario) {
  const configs = {
    'hazira': { id: 'EVT-V2-0007', coords: [21.1055, 72.6465], zoom: 14, btnId: 'btn-demo-hazira' },
    'panipat': { id: 'EVT-V2-0027', coords: [29.4756, 76.8560], zoom: 14, btnId: 'btn-demo-panipat' },
    'forest': { id: 'EVT-V2-0033', coords: [19.1012, 82.1661], zoom: 12, btnId: 'btn-demo-forest' },
    'anomaly': { id: 'EVT-V2-0004', coords: [29.4611, 76.8892], zoom: 14, btnId: 'btn-demo-anomaly' }
  };

  const cfg = configs[scenario];
  if (!cfg) return;

  // 1. Update button styling
  document.querySelectorAll('.demo-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(cfg.btnId);
  if (activeBtn) activeBtn.classList.add('active');

  // 2. Fly map to coordinates (if map initialized)
  if (map && typeof map.flyTo === 'function') {
    try {
      map.flyTo(cfg.coords, cfg.zoom, { duration: 1.2 });
    } catch (e) {
      console.warn('Map flyTo warning:', e);
    }
  }

  // 3. Ensure datasets loaded
  ensureDatasetsLoaded();

  // 4. Find and select the event
  const ev = allEvents.find(e => e.event_id === cfg.id);
  if (ev) {
    selectEvent(ev);
  } else {
    console.warn('Event not found in dataset:', cfg.id);
  }
};

// Initialize Map & Application
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Setup demo button listeners immediately so buttons respond without delay
  setupDemoButtons();

  // 2. Load precomputed data
  await loadDatasets();

  // 3. Initialize Leaflet Map safely (even if offline or missing tiles, UI will not freeze)
  try {
    if (typeof L !== 'undefined') {
      initMap();
      renderFacilities(allFacilities);
      renderEvents(allEvents);
    } else {
      console.warn('Leaflet not loaded; running in evidence drawer inspector mode.');
    }
  } catch (err) {
    console.error('Error initializing map:', err);
  }

  // 4. Default to Showcase 1: Hazira Industrial Flare
  window.handleDemoClick('hazira');
});

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([22.5, 78.5], 5);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Esri World Satellite Imagery (public satellite imagery; falls back seamlessly to dark radar grid when offline)
  try {
    const blankDarkTile = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%230b111e"/><path d="M0 0h256v256H0z" fill="none" stroke="%23162032" stroke-width="1"/></svg>';
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      errorTileUrl: blankDarkTile
    }).addTo(map);
  } catch (e) {
    console.warn('Tile layer offline or blocked:', e);
  }
}

async function loadDatasets() {
  ensureDatasetsLoaded();
  if (allEvents.length > 0 && allFacilities.length > 0) {
    return;
  }

  // Fallback to fetch if running via HTTP web server without data_bundle.js
  try {
    const [eventsRes, facRes] = await Promise.all([
      fetch('../prototype/data/processed/final_event_intelligence.json'),
      fetch('../prototype/data/processed/osm_real_facilities.json')
    ]);

    allEvents = await eventsRes.json();
    allFacilities = await facRes.json();
  } catch (err) {
    console.warn('Local fetch fallback completed with status:', err);
  }
}

function renderFacilities(facilities) {
  if (!map || typeof L === 'undefined') return;
  facilities.forEach(fac => {
    const circle = L.circle([fac.latitude, fac.longitude], {
      radius: 600,
      color: '#00e5ff',
      weight: 1.5,
      dashArray: '4, 6',
      fillColor: '#00e5ff',
      fillOpacity: 0.08
    }).addTo(map);

    circle.bindTooltip(`<b>${fac.name}</b><br>Type: ${fac.facility_type}`, {
      className: 'custom-facility-tooltip',
      direction: 'top'
    });

    facilityLayers.push(circle);
  });
}

function renderEvents(events) {
  if (!map || typeof L === 'undefined') return;
  events.forEach(ev => {
    const lat = ev.spatio_temporal?.centroid?.latitude;
    const lon = ev.spatio_temporal?.centroid?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;

    const domain = ev.classification?.domain;

    let markerColor = '#9c27b0'; // Anomaly default
    if (domain === 'INDUSTRIAL') markerColor = '#ff5252';
    else if (domain === 'WILDFIRE') markerColor = '#ff9800';
    else if (domain === 'AGRICULTURAL') markerColor = '#4caf50';

    const marker = L.circleMarker([lat, lon], {
      radius: ev.event_type === 'MULTI_PASS_TRACKED_EVENT' ? 9 : 5,
      fillColor: markerColor,
      color: '#ffffff',
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.85
    }).addTo(map);

    marker.on('click', () => {
      selectEvent(ev);
    });

    eventMarkers.push({ id: ev.event_id, marker, data: ev });
  });
}

function selectEvent(ev) {
  if (!ev) return;
  try {
    // Update Top Badges & Titles
    const domain = ev.classification?.domain || 'UNKNOWN';
    const domainBadge = document.getElementById('drawer-domain');
    if (domainBadge) {
      domainBadge.textContent = domain;
      domainBadge.className = `badge domain ${domain.toLowerCase()}`;
    }

    const priorityBadge = document.getElementById('drawer-priority');
    if (priorityBadge) {
      priorityBadge.textContent = `${ev.priority || 'LOW'} PRIORITY`;
    }

    const titleEl = document.getElementById('drawer-title');
    if (titleEl) {
      titleEl.textContent = formatSubclassTitle(ev.classification?.subclass || 'Thermal Event');
    }

    const eventIdEl = document.getElementById('drawer-event-id');
    if (eventIdEl) {
      eventIdEl.textContent = `${ev.event_id || 'EVT'} • ${(ev.region || '').toUpperCase()}`;
    }

    // Update Summary Metrics
    const confEl = document.getElementById('drawer-confidence');
    if (confEl) {
      const conf = ev.classification?.confidence_score;
      confEl.textContent = typeof conf === 'number' ? `${(conf * 100).toFixed(0)}%` : 'N/A';
    }

    const persEl = document.getElementById('drawer-persistence');
    if (persEl) {
      const days = ev.spatio_temporal?.active_days;
      persEl.textContent = days > 1 ? `${days} Days` : '1 Day (Single)';
    }

    const obsEl = document.getElementById('drawer-observations');
    if (obsEl) {
      const count = ev.spatio_temporal?.observation_count;
      obsEl.textContent = count ? `${count} Passes` : '1 Pass';
    }

    const driftEl = document.getElementById('drawer-drift-ratio');
    if (driftEl) {
      const drift = ev.spatial_diagnostics?.normalized_optical_drift_ratio;
      driftEl.textContent = typeof drift === 'number' && drift > 0 ? `${drift}x` : 'N/A';
    }

    // Populate Supporting Evidence
    const suppList = document.getElementById('drawer-supporting-list');
    if (suppList) {
      suppList.innerHTML = '';
      const supp = ev.evidence_breakdown?.supporting_evidence || [];
      if (supp.length === 0) {
        suppList.innerHTML = '<li><span class="factor-tag">None</span>No strong positive indicators.</li>';
      } else {
        supp.forEach(s => {
          const li = document.createElement('li');
          li.innerHTML = `<span class="factor-tag">+ ${s.factor || 'Indicator'}</span>${s.description || ''}`;
          suppList.appendChild(li);
        });
      }
    }

    // Populate Counter Evidence
    const counterSection = document.getElementById('counter-section');
    const counterList = document.getElementById('drawer-counter-list');
    if (counterSection && counterList) {
      counterList.innerHTML = '';
      const counter = ev.evidence_breakdown?.counter_evidence || [];
      if (counter.length === 0) {
        counterSection.style.display = 'none';
      } else {
        counterSection.style.display = 'block';
        counter.forEach(c => {
          const li = document.createElement('li');
          li.innerHTML = `<span class="factor-tag">- ${c.factor || 'Counter'}</span>${c.description || ''}`;
          counterList.appendChild(li);
        });
      }
    }

    // Populate Timeline Table
    const timelineBody = document.getElementById('drawer-timeline-body');
    if (timelineBody) {
      timelineBody.innerHTML = '';
      const timeline = ev.observation_timeline || [];
      if (timeline.length > 0) {
        timeline.slice(0, 8).forEach(obs => {
          const tr = document.createElement('tr');
          const timeFormatted = (obs.timestamp || '').replace('T', ' ').replace(':00Z', '');
          const frpVal = typeof obs.frp_mw === 'number' ? obs.frp_mw.toFixed(1) : '-';
          tr.innerHTML = `
            <td>${timeFormatted}</td>
            <td>${obs.satellite || 'VIIRS'}</td>
            <td><span class="pass-tag ${obs.daynight === 'N' ? 'night' : 'day'}">${obs.daynight === 'N' ? 'NIGHT' : 'DAY'}</span></td>
            <td>${frpVal}</td>
          `;
          timelineBody.appendChild(tr);
        });
      } else {
        timelineBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8ea0be;">Single observation</td></tr>';
      }
    }

    // Populate Caveats
    const caveatBox = document.getElementById('drawer-caveats');
    if (caveatBox) {
      caveatBox.innerHTML = '';
      const caveats = ev.uncertainty?.caveats || [];
      caveats.forEach(cav => {
        const p = document.createElement('p');
        p.textContent = `• ${cav}`;
        caveatBox.appendChild(p);
      });
    }
  } catch (err) {
    console.error('Error in selectEvent:', err);
  }
}

function formatSubclassTitle(subclass) {
  if (!subclass) return 'Thermal Event';
  return subclass
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

function setupDemoButtons() {
  const btnHazira = document.getElementById('btn-demo-hazira');
  const btnPanipat = document.getElementById('btn-demo-panipat');
  const btnForest = document.getElementById('btn-demo-forest');
  const btnAnomaly = document.getElementById('btn-demo-anomaly');

  if (btnHazira) {
    btnHazira.onclick = () => window.handleDemoClick('hazira');
  }
  if (btnPanipat) {
    btnPanipat.onclick = () => window.handleDemoClick('panipat');
  }
  if (btnForest) {
    btnForest.onclick = () => window.handleDemoClick('forest');
  }
  if (btnAnomaly) {
    btnAnomaly.onclick = () => window.handleDemoClick('anomaly');
  }
}
