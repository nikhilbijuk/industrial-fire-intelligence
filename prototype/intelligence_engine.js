/**
 * Industrial Fire Intelligence - Phase 2 & 3 Deterministic Evidence Engine
 * Enriches V2 Thermal Events with OSM Industrial Context and generates explainable
 * evidence evaluations, overpass timelines, and uncertainty caveats.
 * 100% OFFLINE, ZERO EXTERNAL NETWORK CALLS.
 */

const fs = require('fs');
const path = require('path');

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000.0;
  const toRad = deg => (deg * Math.PI) / 180.0;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlambda = toRad(lon2 - lon1);

  const a = Math.sin(dphi / 2.0) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2.0) ** 2;
  return 2.0 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
}

function runIntelligenceEngine() {
  const eventsPath = path.join('prototype', 'data', 'processed', 'aggregated_thermal_events_v2.json');
  const facilitiesPath = path.join('prototype', 'data', 'processed', 'osm_demo_facilities.json');
  const rawCsvPath = path.join('prototype', 'data', 'processed', 'firms_real_sample_3regions.csv');

  console.log('[Evidence Engine] Loading V2 Events and OSM Facilities...');
  const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
  const facilities = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

  // Load raw detections for observation timelines
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

  const enrichedEvents = [];

  for (const ev of events) {
    const cLat = ev.spatio_temporal.centroid.latitude;
    const cLon = ev.spatio_temporal.centroid.longitude;

    // 1. Spatial Join: Find Nearest OSM Facility
    let nearestFacility = null;
    let minDistanceM = Infinity;

    for (const fac of facilities) {
      const d = haversineDistanceMeters(cLat, cLon, fac.centroid.latitude, fac.centroid.longitude);
      if (d < minDistanceM) {
        minDistanceM = d;
        nearestFacility = fac;
      }
    }

    const isInsideFacilityBuffer = minDistanceM <= (nearestFacility ? nearestFacility.radius_meters : 0);
    const isIndustrialType = nearestFacility && nearestFacility.landuse === 'industrial';
    const isForestType = nearestFacility && nearestFacility.landuse === 'forest_reserve';

    // 2. Associate Matching Individual Observations (Timeline)
    const matchingObs = rawDetections.filter(d => {
      const dist = haversineDistanceMeters(cLat, cLon, d.lat, d.lon);
      return dist <= (ev.spatial_diagnostics.raw_max_drift_meters + 300.0);
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    // 3. Deterministic Evidence Scoring
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

    if (ev.event_type === 'SINGLE_PASS_ANOMALY') {
      domain = (isInsideFacilityBuffer && isIndustrialType) ? 'INDUSTRIAL' : 'OTHER';
      subclass = 'SINGLE_PASS_ANOMALY';
      confidenceLabel = 'LOW';
      confidenceScore = 0.40;
      priority = (isInsideFacilityBuffer && isIndustrialType) ? 'MEDIUM' : 'LOW';

      if (isInsideFacilityBuffer && isIndustrialType) {
        supporting.push({
          factor: 'Facility Perimeter Proximity',
          description: `Detected within ${Math.round(minDistanceM)}m of ${nearestFacility.name} (${nearestFacility.operator})`,
          weight: 0.30
        });
      } else {
        counter.push({
          factor: 'Facility Absence',
          description: `No industrial facility detected within 2km (nearest is ${Math.round(minDistanceM)}m away)`,
          weight: -0.20
        });
      }
      caveats.push('Single satellite observation. Insufficient temporal data to evaluate persistence or physical spread.');
    } else {
      // MULTI_PASS_TRACKED_EVENT
      if (isIndustrialType && (minDistanceM <= 1500.0 || isInsideFacilityBuffer)) {
        domain = 'INDUSTRIAL';
        if (activeDays >= 2 && opticalRatio <= 1.0) {
          subclass = 'PERSISTENT_OPERATIONAL_SOURCE';
          confidenceLabel = 'HIGH';
          confidenceScore = 0.91;
          priority = 'MEDIUM'; // Operational monitoring, not emergency dispatch
        } else {
          subclass = 'ABNORMAL_INDUSTRIAL_EVENT';
          confidenceLabel = 'HIGH';
          confidenceScore = 0.84;
          priority = 'CRITICAL';
        }

        supporting.push({
          factor: 'Industrial Infrastructure Proximity',
          description: `Event centroid is ${Math.round(minDistanceM)}m from ${nearestFacility.name} (${nearestFacility.operator})`,
          weight: 0.35
        });

        if (activeDays >= 3) {
          supporting.push({
            factor: 'Multi-Day Temporal Persistence',
            description: `Recurrent thermal emissions recorded across ${activeDays} distinct days (${ev.spatio_temporal.duration_hours}h duration)`,
            weight: 0.25
          });
        }

        if (opticalRatio <= 1.0) {
          supporting.push({
            factor: 'Stationary Point Source (Flare Stack)',
            description: `Normalized optical drift ratio is ${opticalRatio} (<= 1.0); coordinate shifts are fully accounted for by satellite pixel footprint elongation`,
            weight: 0.25
          });
        }

        if (nightRatio >= 0.35) {
          supporting.push({
            factor: 'Continuous 24/7 Thermal Emission',
            description: `${Math.round(nightRatio * 100)}% of satellite passes occurred at night, characteristic of continuous industrial operations`,
            weight: 0.15
          });
        }

        caveats.push('At VIIRS 375m-800m pixel footprint, detection represents high-probability facility association rather than sub-meter stack attribution.');

      } else if (isForestType || (minDistanceM > 5000 && ev.region === 'eastern_ghats_forest')) {
        domain = 'WILDFIRE';
        subclass = 'FOREST_CANOPY_FIRE';
        confidenceLabel = 'HIGH';
        confidenceScore = 0.89;
        priority = 'HIGH';

        supporting.push({
          factor: 'Protected Forest Landcover',
          description: `Thermal event located in ${nearestFacility ? nearestFacility.name : 'forest biome'}`,
          weight: 0.35
        });

        if (opticalRatio > 1.2 || ev.spatial_diagnostics.raw_max_drift_meters > 500.0) {
          supporting.push({
            factor: 'Expanding Fire Front',
            description: `Spatial drift of ${ev.spatial_diagnostics.raw_max_drift_meters}m exceeds stationary footprint; indicates active perimeter spread along terrain`,
            weight: 0.30
          });
        }

        if (nightRatio > 0.0) {
          supporting.push({
            factor: 'Overnight Fire Persistence',
            description: 'Thermal energy detected during nighttime overpass, indicating sustained heavy fuel combustion',
            weight: 0.20
          });
        }

        counter.push({
          factor: 'Zero Industrial Infrastructure',
          description: `Located ${Math.round(minDistanceM / 1000)}km from any recorded industrial facility`,
          weight: -0.15
        });

        caveats.push('Cloud cover and canopy density can partially attenuate thermal radiative power.');

      } else {
        // Agricultural Stubble Burning Plain
        domain = 'AGRICULTURAL';
        subclass = 'CROP_RESIDUE_BURNING';
        confidenceLabel = 'HIGH';
        confidenceScore = 0.87;
        priority = 'LOW';

        supporting.push({
          factor: 'Agricultural Plain Context',
          description: 'Event situated in open agricultural cropland belt outside industrial zones',
          weight: 0.35
        });

        if (nightRatio === 0.0) {
          supporting.push({
            factor: 'Diurnal Harvest Restriction',
            description: '100% of detections occurred during daylight overpasses, characteristic of field clearing practices',
            weight: 0.25
          });
        }

        if (ev.spatio_temporal.duration_hours <= 48.0) {
          supporting.push({
            factor: 'Short Lived Ephemeral Burn',
            description: `Total duration limited to ${ev.spatio_temporal.duration_hours}h; dissipates rapidly once crop residue clears`,
            weight: 0.20
          });
        }

        counter.push({
          factor: 'Facility Absence',
          description: `No industrial infrastructure within ${Math.round(minDistanceM / 1000)}km buffer`,
          weight: -0.20
        });

        caveats.push('High smoke opacity can cause nearby false detections on adjacent optical channels.');
      }
    }

    enrichedEvents.push({
      event_id: ev.event_id,
      event_type: ev.event_type,
      region: ev.region,
      spatio_temporal: ev.spatio_temporal,
      spatial_diagnostics: ev.spatial_diagnostics,
      thermal_diagnostics: ev.thermal_diagnostics,
      context: {
        nearest_facility_name: nearestFacility ? nearestFacility.name : 'Unknown',
        nearest_facility_type: nearestFacility ? nearestFacility.facility_type : 'none',
        operator: nearestFacility ? nearestFacility.operator : 'none',
        distance_to_facility_meters: Math.round(minDistanceM),
        inside_facility_buffer: isInsideFacilityBuffer
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

  const outPath = path.join('prototype', 'data', 'processed', 'final_event_intelligence.json');
  fs.writeFileSync(outPath, JSON.stringify(enrichedEvents, null, 2), 'utf8');
  console.log(`[Evidence Engine] Successfully enriched ${enrichedEvents.length} events with OSM context & evidence.`);
  console.log(`[Evidence Engine] Saved final dataset to ${outPath}\n`);

  // Quick verification of our 3 Demo Showcase Cases
  const hazira = enrichedEvents.find(e => e.event_id === 'EVT-V2-0007');
  const panipat = enrichedEvents.find(e => e.event_id === 'EVT-V2-0027');
  const forest = enrichedEvents.find(e => e.classification.domain === 'WILDFIRE');

  console.log('=== SHOWCASE 1: HAZIRA INDUSTRIAL FLARE ===');
  console.log(`ID: ${hazira.event_id} -> ${hazira.classification.domain} (${hazira.classification.subclass})`);
  console.log(`Facility: ${hazira.context.nearest_facility_name} (${hazira.context.distance_to_facility_meters}m away)`);
  console.log(`Confidence: ${hazira.classification.confidence_label} (${hazira.classification.confidence_score*100}%) | Priority: ${hazira.priority}`);
  console.log('Why?');
  hazira.evidence_breakdown.supporting_evidence.forEach(s => console.log(`  + ${s.factor}: ${s.description}`));

  console.log('\n=== SHOWCASE 2: PANIPAT REFINERY FLARE ===');
  console.log(`ID: ${panipat.event_id} -> ${panipat.classification.domain} (${panipat.classification.subclass})`);
  console.log(`Facility: ${panipat.context.nearest_facility_name} (${panipat.context.distance_to_facility_meters}m away)`);
  console.log(`Confidence: ${panipat.classification.confidence_label} (${panipat.classification.confidence_score*100}%) | Priority: ${panipat.priority}`);
  console.log('Why?');
  panipat.evidence_breakdown.supporting_evidence.forEach(s => console.log(`  + ${s.factor}: ${s.description}`));

  console.log('\n=== SHOWCASE 3: FOREST WILDFIRE ===');
  console.log(`ID: ${forest.event_id} -> ${forest.classification.domain} (${forest.classification.subclass})`);
  console.log(`Context: ${forest.context.nearest_facility_name} (${forest.context.distance_to_facility_meters}m away)`);
  console.log(`Confidence: ${forest.classification.confidence_label} (${forest.classification.confidence_score*100}%) | Priority: ${forest.priority}`);
  console.log('Why?');
  forest.evidence_breakdown.supporting_evidence.forEach(s => console.log(`  + ${s.factor}: ${s.description}`));
}

runIntelligenceEngine();
