/**
 * Industrial Fire Intelligence - Phase 2 Real OSM Normalization & Geodesic Matching
 * Connects Real Overpass OSM Extractions with V2 Thermal Events using true spherical
 * geodesic distance (Haversine, R = 6,371,000m). No degree-to-meter approximations.
 */

const fs = require('fs');
const path = require('path');

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000.0; // WGS84 mean earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180.0;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlambda = toRad(lon2 - lon1);

  const a = Math.sin(dphi / 2.0) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2.0) ** 2;
  return 2.0 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
}

function normalizeOsmFacilities() {
  const rawDir = path.join('prototype', 'data', 'raw');
  const files = [
    { file: 'osm_hazira_industrial.json', region: 'gujarat_industrial', defaultType: 'industrial_area' },
    { file: 'osm_panipat_industrial.json', region: 'punjab_agriculture', defaultType: 'refinery' },
    { file: 'osm_simlipal_reserve.json', region: 'eastern_ghats_forest', defaultType: 'protected_forest' }
  ];

  const facilities = [];

  for (const { file, region, defaultType } of files) {
    const p = path.join(rawDir, file);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));

    (data.elements || []).forEach(el => {
      const lat = el.lat || (el.center ? el.center.lat : null);
      const lon = el.lon || (el.center ? el.center.lon : null);
      if (!lat || !lon) return;

      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || tags['operator'] || `${defaultType.replace('_', ' ')} unit`;
      
      let type = defaultType;
      if (tags.industrial === 'refinery' || tags.landuse === 'refinery' || name.toLowerCase().includes('refinery')) {
        type = 'refinery';
      } else if (tags.power === 'plant' || name.toLowerCase().includes('power')) {
        type = 'power_plant';
      } else if (name.toLowerCase().includes('steel')) {
        type = 'steel_mill';
      } else if (tags.leisure === 'nature_reserve' || tags.boundary === 'national_park' || name.toLowerCase().includes('reserve') || name.toLowerCase().includes('park')) {
        type = 'protected_forest';
      } else if (tags.landuse === 'industrial' || tags.industrial) {
        type = 'industrial_complex';
      }

      facilities.push({
        facility_id: `OSM-${el.type.toUpperCase()}-${el.id}`,
        name: name,
        facility_type: type,
        operator: tags.operator || 'Unknown',
        region: region,
        latitude: lat,
        longitude: lon,
        tags: Object.keys(tags).filter(k => !k.startsWith('name') && !k.startsWith('source'))
      });
    });
  }

  const outFacPath = path.join('prototype', 'data', 'processed', 'osm_real_facilities.json');
  fs.writeFileSync(outFacPath, JSON.stringify(facilities, null, 2), 'utf8');
  console.log(`[Phase 2] Normalized ${facilities.length} real OSM facilities to ${outFacPath}`);
  return facilities;
}

function runRealGeodesicIntelligence() {
  const facilities = normalizeOsmFacilities();
  const eventsPath = path.join('prototype', 'data', 'processed', 'aggregated_thermal_events_v2.json');
  const rawCsvPath = path.join('prototype', 'data', 'processed', 'firms_real_sample_3regions.csv');

  const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
  const rawCsv = fs.readFileSync(rawCsvPath, 'utf8').trim().split(/\r?\n/);
  const rawDetections = [];
  for (let i = 1; i < rawCsv.length; i++) {
    const r = rawCsv[i].split(',');
    if (r.length < 13) continue;
    rawDetections.push({
      lat: parseFloat(r[0]),
      lon: parseFloat(r[1]),
      ti4: parseFloat(r[2]),
      scan: parseFloat(r[3]),
      track: parseFloat(r[4]),
      date: r[5],
      time: String(r[6]).padStart(4, '0'),
      satellite: r[7],
      confidence: r[8],
      ti5: parseFloat(r[10]),
      frp: parseFloat(r[11]),
      daynight: r[12].trim()
    });
  }

  const evaluatedEvents = [];

  for (const ev of events) {
    const cLat = ev.spatio_temporal.centroid.latitude;
    const cLon = ev.spatio_temporal.centroid.longitude;

    // True Geodesic Metric Distance Calculation
    let nearestFacility = null;
    let minDistanceMeters = Infinity;

    for (const fac of facilities) {
      const d = haversineDistanceMeters(cLat, cLon, fac.latitude, fac.longitude);
      if (d < minDistanceMeters) {
        minDistanceMeters = d;
        nearestFacility = fac;
      }
    }

    // Associate individual detections for timeline
    const matchingObs = rawDetections.filter(d => {
      const dist = haversineDistanceMeters(cLat, cLon, d.lat, d.lon);
      return dist <= (ev.spatial_diagnostics.raw_max_drift_meters + 400.0);
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const supporting = [];
    const counter = [];
    const caveats = [];
    let domain = 'UNKNOWN';
    let subclass = 'UNCLASSIFIED';
    let confidenceLabel = 'LOW';
    let confidenceScore = 0.50;
    let priority = 'LOW';

    const obsCount = ev.spatio_temporal.observation_count;
    const activeDays = ev.spatio_temporal.active_days;
    const nightRatio = ev.spatio_temporal.night_ratio;
    const opticalRatio = ev.spatial_diagnostics.normalized_optical_drift_ratio;
    const distM = Math.round(minDistanceMeters);

    const isIndustrialFacility = nearestFacility && nearestFacility.facility_type !== 'protected_forest';
    const isCloseToIndustrial = distM <= 2000;

    if (ev.event_type === 'SINGLE_PASS_ANOMALY') {
      domain = isCloseToIndustrial ? 'INDUSTRIAL' : 'OTHER';
      subclass = 'SINGLE_PASS_ANOMALY';
      confidenceLabel = 'LOW';
      confidenceScore = 0.40;
      priority = isCloseToIndustrial ? 'MEDIUM' : 'LOW';

      if (isCloseToIndustrial) {
        supporting.push({
          factor: 'Industrial Facility Proximity',
          description: `Located ${distM}m from real OSM facility: ${nearestFacility.name} (${nearestFacility.facility_type})`,
          weight: 0.30
        });
      } else {
        counter.push({
          factor: 'Industrial Facility Absence',
          description: `No industrial facility recorded within 2km (nearest is ${distM}m away)`,
          weight: -0.20
        });
      }
      caveats.push('Single satellite observation. Insufficient temporal data to evaluate persistence or physical spread.');
      caveats.push('FIRMS detects a thermal anomaly; proximity alone does not constitute proof of facility-level attribution.');

    } else {
      // MULTI_PASS_TRACKED_EVENT
      if (isIndustrialFacility && isCloseToIndustrial) {
        domain = 'INDUSTRIAL';
        if (activeDays >= 2 && opticalRatio <= 1.0) {
          subclass = 'PERSISTENT_OPERATIONAL_SOURCE';
          confidenceLabel = 'HIGH';
          confidenceScore = 0.91;
          priority = 'MEDIUM'; // Operational tracking
        } else {
          subclass = 'ABNORMAL_INDUSTRIAL_EVENT';
          confidenceLabel = 'HIGH';
          confidenceScore = 0.84;
          priority = 'CRITICAL';
        }

        supporting.push({
          factor: 'Industrial Infrastructure Proximity',
          description: `Event centroid is ${distM}m from real OSM facility: ${nearestFacility.name} (${nearestFacility.facility_type})`,
          weight: 0.35
        });

        if (activeDays >= 3) {
          supporting.push({
            factor: 'Multi-Day Temporal Persistence',
            description: `Recurrent thermal detections observed across ${activeDays} separate calendar days (${ev.spatio_temporal.duration_hours}h duration)`,
            weight: 0.25
          });
        }

        // SCIENTIFICALLY DEFENSIBLE WORDING:
        if (opticalRatio <= 1.0) {
          supporting.push({
            factor: 'Stationary Footprint Consistency',
            description: `Normalized optical drift ratio is ${opticalRatio} (<= 1.0); observed coordinate displacement is within the estimated sensor pixel footprint, consistent with a stationary source`,
            weight: 0.25
          });
        }

        if (nightRatio >= 0.35) {
          supporting.push({
            factor: 'Continuous 24/7 Combustion',
            description: `${Math.round(nightRatio * 100)}% of detections occurred during night overpasses, consistent with continuous industrial operations`,
            weight: 0.15
          });
        }

        caveats.push('FIRMS detects a thermal anomaly; proximity does not constitute proof of facility-level attribution.');
        caveats.push('At VIIRS 375m-800m pixel footprint, detection represents high-probability spatial association.');

      } else if (ev.region === 'eastern_ghats_forest' || (nearestFacility && nearestFacility.facility_type === 'protected_forest')) {
        domain = 'WILDFIRE';
        subclass = 'FOREST_CANOPY_FIRE';
        confidenceLabel = 'HIGH';
        confidenceScore = 0.89;
        priority = 'HIGH';

        supporting.push({
          factor: 'Forest Reserve Biome Context',
          description: `Thermal event situated in forested mountain corridor (${nearestFacility ? nearestFacility.name : 'Eastern Ghats'})`,
          weight: 0.35
        });

        if (opticalRatio > 1.1 || ev.spatial_diagnostics.raw_max_drift_meters > 500.0) {
          supporting.push({
            factor: 'Propagating Fire Perimeter',
            description: `Spatial drift of ${ev.spatial_diagnostics.raw_max_drift_meters}m exceeds stationary footprint; indicates spreading fire front along terrain`,
            weight: 0.30
          });
        }

        if (nightRatio > 0.0) {
          supporting.push({
            factor: 'Overnight Fire Persistence',
            description: 'Thermal activity recorded during nighttime passes, indicating sustained heavy fuel combustion',
            weight: 0.20
          });
        }

        counter.push({
          factor: 'Zero Industrial Infrastructure',
          description: `Nearest industrial facility is ${Math.round(distM / 1000)}km away`,
          weight: -0.20
        });

        caveats.push('Dense canopy and cloud cover can attenuate thermal radiation.');

      } else {
        // Agricultural Stubble Burning
        domain = 'AGRICULTURAL';
        subclass = 'CROP_RESIDUE_BURNING';
        confidenceLabel = 'HIGH';
        confidenceScore = 0.87;
        priority = 'LOW';

        supporting.push({
          factor: 'Agricultural Plain Context',
          description: 'Thermal event situated in rural agricultural belt outside mapped industrial infrastructure',
          weight: 0.35
        });

        if (nightRatio === 0.0) {
          supporting.push({
            factor: 'Diurnal Daylight Restriction',
            description: '100% of observations occurred during daylight overpasses, characteristic of crop residue clearing',
            weight: 0.25
          });
        }

        if (ev.spatio_temporal.duration_hours <= 48.0) {
          supporting.push({
            factor: 'Short-Lived Ephemeral Burn',
            description: `Duration limited to ${ev.spatio_temporal.duration_hours}h; dissipates rapidly once residue is cleared`,
            weight: 0.20
          });
        }

        counter.push({
          factor: 'Facility Absence',
          description: `No industrial infrastructure detected within ${Math.round(distM / 1000)}km`,
          weight: -0.20
        });

        caveats.push('Smoke plumes can cause adjacent optical channel artifacts.');
      }
    }

    evaluatedEvents.push({
      event_id: ev.event_id,
      event_type: ev.event_type,
      region: ev.region,
      spatio_temporal: ev.spatio_temporal,
      spatial_diagnostics: ev.spatial_diagnostics,
      thermal_diagnostics: ev.thermal_diagnostics,
      context: {
        nearest_facility_name: nearestFacility ? nearestFacility.name : 'None Detected',
        nearest_facility_type: nearestFacility ? nearestFacility.facility_type : 'none',
        operator: nearestFacility ? nearestFacility.operator : 'none',
        geodesic_distance_meters: distM,
        facility_coordinates: nearestFacility ? [nearestFacility.latitude, nearestFacility.longitude] : null
      },
      classification: {
        domain: domain,
        subclass: subclass,
        confidence_label: confidenceLabel,
        confidence_score: confidenceScore
      },
      evidence_breakdown: {
        supporting_evidence: supporting,
        counter_evidence: counter
      },
      uncertainty: {
        level: ev.uncertainty.level,
        caveats: caveats
      },
      priority: priority,
      observation_timeline: matchingObs.map(o => ({
        timestamp: `${o.date}T${o.time.substring(0,2)}:${o.time.substring(2,4)}:00Z`,
        satellite: o.satellite,
        frp_mw: o.frp,
        brightness_ti4_k: o.ti4,
        daynight: o.daynight,
        confidence: o.confidence
      }))
    });
  }

  const outFinalPath = path.join('prototype', 'data', 'processed', 'final_event_intelligence.json');
  fs.writeFileSync(outFinalPath, JSON.stringify(evaluatedEvents, null, 2), 'utf8');
  console.log(`[Phase 2 Complete] Evaluated ${evaluatedEvents.length} events against real OSM data. Saved to ${outFinalPath}`);
}

runRealGeodesicIntelligence();
