/**
 * Industrial Fire Intelligence - Web Dashboard Controller
 * Connects pre-processed V2 Thermal Events and Real OSM Facilities with Leaflet map
 * and populates the Explainable Evidence Inspector Drawer.
 * 100% Client-side, zero live external API calls.
 */

let map;
let eventMarkers = [];
let facilityLayers = [];
let allEvents = [];
let allFacilities = [];

// Initialize Map & Application
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadDatasets();
  setupDemoButtons();
  
  // Default to Showcase 1: Hazira Industrial Flare
  triggerShowcase('EVT-V2-0007', [21.1055, 72.6465], 14);
});

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([22.5, 78.5], 5);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Free Dark Mode Basemap (CARTO Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);
}

async function loadDatasets() {
  // 1. Direct standalone support: check if loaded via data_bundle.js (works on direct file:// double-click)
  if (window.PRECOMPUTED_EVENTS && window.PRECOMPUTED_FACILITIES) {
    allEvents = window.PRECOMPUTED_EVENTS;
    allFacilities = window.PRECOMPUTED_FACILITIES;
    renderFacilities(allFacilities);
    renderEvents(allEvents);
    return;
  }

  // 2. Fallback to fetch if running via HTTP web server
  try {
    const [eventsRes, facRes] = await Promise.all([
      fetch('../prototype/data/processed/final_event_intelligence.json'),
      fetch('../prototype/data/processed/osm_real_facilities.json')
    ]);

    allEvents = await eventsRes.json();
    allFacilities = await facRes.json();

    renderFacilities(allFacilities);
    renderEvents(allEvents);
  } catch (err) {
    console.error('Error loading local datasets:', err);
  }
}

function renderFacilities(facilities) {
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
  events.forEach(ev => {
    const lat = ev.spatio_temporal.centroid.latitude;
    const lon = ev.spatio_temporal.centroid.longitude;
    const domain = ev.classification.domain;

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
  // Update Top Badges & Titles
  const domainBadge = document.getElementById('drawer-domain');
  domainBadge.textContent = ev.classification.domain;
  domainBadge.className = `badge domain ${ev.classification.domain.toLowerCase()}`;

  const priorityBadge = document.getElementById('drawer-priority');
  priorityBadge.textContent = `${ev.priority} PRIORITY`;

  document.getElementById('drawer-title').textContent = formatSubclassTitle(ev.classification.subclass);
  document.getElementById('drawer-event-id').textContent = `${ev.event_id} • ${ev.region.toUpperCase()}`;

  // Update Summary Metrics
  document.getElementById('drawer-confidence').textContent = `${(ev.classification.confidence_score * 100).toFixed(0)}%`;
  document.getElementById('drawer-persistence').textContent = ev.spatio_temporal.active_days > 1 
    ? `${ev.spatio_temporal.active_days} Days` 
    : '1 Day (Single)';
  document.getElementById('drawer-observations').textContent = `${ev.spatio_temporal.observation_count} Passes`;
  document.getElementById('drawer-drift-ratio').textContent = ev.spatial_diagnostics.normalized_optical_drift_ratio > 0
    ? `${ev.spatial_diagnostics.normalized_optical_drift_ratio}x`
    : 'N/A';

  // Populate Supporting Evidence
  const suppList = document.getElementById('drawer-supporting-list');
  suppList.innerHTML = '';
  if (ev.evidence_breakdown.supporting_evidence.length === 0) {
    suppList.innerHTML = '<li><span class="factor-tag">None</span>No strong positive indicators.</li>';
  } else {
    ev.evidence_breakdown.supporting_evidence.forEach(s => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="factor-tag">+ ${s.factor}</span>${s.description}`;
      suppList.appendChild(li);
    });
  }

  // Populate Counter Evidence
  const counterSection = document.getElementById('counter-section');
  const counterList = document.getElementById('drawer-counter-list');
  counterList.innerHTML = '';
  if (ev.evidence_breakdown.counter_evidence.length === 0) {
    counterSection.style.display = 'none';
  } else {
    counterSection.style.display = 'block';
    ev.evidence_breakdown.counter_evidence.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="factor-tag">- ${c.factor}</span>${c.description}`;
      counterList.appendChild(li);
    });
  }

  // Populate Timeline Table
  const timelineBody = document.getElementById('drawer-timeline-body');
  timelineBody.innerHTML = '';
  if (ev.observation_timeline && ev.observation_timeline.length > 0) {
    ev.observation_timeline.slice(0, 8).forEach(obs => {
      const tr = document.createElement('tr');
      const timeFormatted = obs.timestamp.replace('T', ' ').replace(':00Z', '');
      tr.innerHTML = `
        <td>${timeFormatted}</td>
        <td>${obs.satellite}</td>
        <td><span class="pass-tag ${obs.daynight === 'N' ? 'night' : 'day'}">${obs.daynight === 'N' ? 'NIGHT' : 'DAY'}</span></td>
        <td>${obs.frp_mw.toFixed(1)}</td>
      `;
      timelineBody.appendChild(tr);
    });
  } else {
    timelineBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8ea0be;">Single observation</td></tr>';
  }

  // Populate Caveats
  const caveatBox = document.getElementById('drawer-caveats');
  caveatBox.innerHTML = '';
  ev.uncertainty.caveats.forEach(cav => {
    const p = document.createElement('p');
    p.textContent = `• ${cav}`;
    caveatBox.appendChild(p);
  });
}

function formatSubclassTitle(subclass) {
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

  const btns = [btnHazira, btnPanipat, btnForest, btnAnomaly];

  btnHazira.addEventListener('click', () => {
    setActiveBtn(btnHazira, btns);
    triggerShowcase('EVT-V2-0007', [21.1055, 72.6465], 14);
  });

  btnPanipat.addEventListener('click', () => {
    setActiveBtn(btnPanipat, btns);
    triggerShowcase('EVT-V2-0027', [29.4756, 76.8560], 14);
  });

  btnForest.addEventListener('click', () => {
    setActiveBtn(btnForest, btns);
    triggerShowcase('EVT-V2-0033', [19.1012, 82.1661], 12);
  });

  btnAnomaly.addEventListener('click', () => {
    setActiveBtn(btnAnomaly, btns);
    triggerShowcase('EVT-V2-0004', [29.4611, 76.8892], 14);
  });
}

function setActiveBtn(activeBtn, allBtns) {
  allBtns.forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
}

function triggerShowcase(eventId, coords, zoom) {
  map.flyTo(coords, zoom, { duration: 1.2 });
  const ev = allEvents.find(e => e.event_id === eventId);
  if (ev) {
    selectEvent(ev);
  }
}
