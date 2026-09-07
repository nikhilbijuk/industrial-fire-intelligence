/**
 * Industrial Fire Intelligence - Phase 1.1 Refined Event Aggregator (V2)
 * Centroid-Constrained Spatio-Temporal Aggregation with Dynamic Footprint Weighting.
 *
 * Replaces naive single-linkage chaining with running-centroid constraints
 * and normalizes spatial drift against VIIRS scan/track pixel footprint.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURABLE PARAMETERS (Hypotheses, NOT Scientific Constants)
// ============================================================================
const CONFIG = {
  // Base spatial search radius at satellite nadir (meters)
  BASE_SPATIAL_RADIUS_METERS: 750.0,

  // Maximum temporal inactivity gap before closing an event (hours)
  TEMPORAL_WINDOW_HOURS: 72.0,

  // VIIRS 375m I-band nominal nadir resolution (km)
  NADIR_PIXEL_KM: 0.375,

  // Enable dynamic footprint scaling based on scan and track
  ENABLE_FOOTPRINT_SCALING: true,

  // Maximum allowed footprint inflation multiplier (caps scan-edge radius)
  MAX_FOOTPRINT_SCALE_FACTOR: 2.2
};

// ============================================================================
// GEODESIC & SPATIAL UTILITIES
// ============================================================================
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000.0; // Earth mean radius in meters
  const toRad = deg => (deg * Math.PI) / 180.0;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlambda = toRad(lon2 - lon1);

  const a = Math.sin(dphi / 2.0) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2.0) ** 2;
  return 2.0 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
}

function parseFirmsDatetime(dateStr, timeStr) {
  const paddedTime = String(timeStr).trim().padStart(4, '0');
  const hours = paddedTime.substring(0, 2);
  const minutes = paddedTime.substring(2, 4);
  return new Date(`${dateStr}T${hours}:${minutes}:00Z`);
}

/**
 * Calculates the nominal geometric pixel radius (in meters) for a VIIRS detection.
 * Account for off-nadir pixel growth in scan and track directions.
 */
function calculatePixelRadiusMeters(scanKm, trackKm) {
  const scan = scanKm || 0.375;
  const track = trackKm || 0.375;
  // Semi-major axis of elliptical pixel footprint
  return 0.5 * Math.sqrt(scan * scan + track * track) * 1000.0;
}

// ============================================================================
// REFINED CENTROID-CONSTRAINED AGGREGATION ENGINE (V2)
// ============================================================================
class ThermalEventCluster {
  constructor(initialDetection, eventId) {
    this.eventId = eventId;
    this.detections = [initialDetection];
    this.centroidLat = initialDetection.lat;
    this.centroidLon = initialDetection.lon;
    this.firstDt = initialDetection.datetime;
    this.lastDt = initialDetection.datetime;
    this.regionTag = initialDetection.region_tag;
  }

  /**
   * Evaluates if a new detection can join this cluster based on:
   * 1. Inactivity gap <= TEMPORAL_WINDOW_HOURS from last cluster detection
   * 2. Distance to RUNNING CENTROID <= Effective Footprint-Scaled Radius
   */
  canAbsorb(detection, config) {
    const timeDiffHours = (detection.datetime - this.lastDt) / (1000 * 3600);
    if (timeDiffHours < 0 || timeDiffHours > config.TEMPORAL_WINDOW_HOURS) {
      return { canAbsorb: false, distanceMeters: Infinity, effectiveRadiusMeters: 0 };
    }

    const distToCentroid = haversineDistanceMeters(
      detection.lat, detection.lon,
      this.centroidLat, this.centroidLon
    );

    let effectiveRadius = config.BASE_SPATIAL_RADIUS_METERS;
    if (config.ENABLE_FOOTPRINT_SCALING) {
      const pixelArea = (detection.scan || config.NADIR_PIXEL_KM) * (detection.track || config.NADIR_PIXEL_KM);
      const nadirArea = config.NADIR_PIXEL_KM * config.NADIR_PIXEL_KM;
      const scaleFactor = Math.min(
        config.MAX_FOOTPRINT_SCALE_FACTOR,
        Math.max(1.0, Math.sqrt(pixelArea / nadirArea))
      );
      effectiveRadius = config.BASE_SPATIAL_RADIUS_METERS * scaleFactor;
    }

    const canAbsorb = distToCentroid <= effectiveRadius;
    return {
      canAbsorb,
      distanceMeters: distToCentroid,
      effectiveRadiusMeters: effectiveRadius,
      normalizedDistance: distToCentroid / effectiveRadius
    };
  }

  addDetection(detection) {
    this.detections.push(detection);
    // Incrementally update running centroid
    const n = this.detections.length;
    this.centroidLat = ((n - 1) * this.centroidLat + detection.lat) / n;
    this.centroidLon = ((n - 1) * this.centroidLon + detection.lon) / n;
    if (detection.datetime > this.lastDt) {
      this.lastDt = detection.datetime;
    }
  }
}

function aggregateDetectionsV2(detections, config = CONFIG) {
  // Sort strictly chronologically
  const sorted = [...detections].sort((a, b) => a.datetime - b.datetime);
  const activeClusters = [];
  let eventCounter = 1;

  for (const det of sorted) {
    let bestCandidate = null;
    let minNormalizedDist = Infinity;

    // Evaluate all active clusters
    for (const cluster of activeClusters) {
      const evaluation = cluster.canAbsorb(det, config);
      if (evaluation.canAbsorb && evaluation.normalizedDistance < minNormalizedDist) {
        minNormalizedDist = evaluation.normalizedDistance;
        bestCandidate = cluster;
      }
    }

    if (bestCandidate) {
      bestCandidate.addDetection(det);
    } else {
      const newCluster = new ThermalEventCluster(
        det,
        `EVT-V2-${String(eventCounter++).padStart(4, '0')}`
      );
      activeClusters.push(newCluster);
    }
  }

  return activeClusters;
}

// ============================================================================
// EVENT CHARACTERIZATION & NORMALIZATION
// ============================================================================
function characterizeEvent(cluster) {
  const dets = cluster.detections;
  const n = dets.length;
  const cLat = cluster.centroidLat;
  const cLon = cluster.centroidLon;

  const firstDt = cluster.firstDt;
  const lastDt = cluster.lastDt;
  const durationHours = (lastDt - firstDt) / (1000 * 3600);
  const uniqueDays = new Set(dets.map(p => p.datetime.toISOString().split('T')[0]));
  const activeDays = uniqueDays.size;

  // Compute raw coordinate drifts from final centroid
  const drifts = dets.map(p => haversineDistanceMeters(cLat, cLon, p.lat, p.lon));
  const maxDrift = Math.max(...drifts);
  const meanDrift = drifts.reduce((a, b) => a + b, 0) / n;

  // Compute pixel footprints and normalized optical drift ratios
  const normalizedDrifts = dets.map(p => {
    const d = haversineDistanceMeters(cLat, cLon, p.lat, p.lon);
    const pixelRadius = calculatePixelRadiusMeters(p.scan, p.track);
    return d / pixelRadius;
  });
  const maxNormalizedDrift = Math.max(...normalizedDrifts);
  const meanNormalizedDrift = normalizedDrifts.reduce((a, b) => a + b, 0) / n;

  const frps = dets.map(p => p.frp);
  const meanFrp = frps.reduce((a, b) => a + b, 0) / n;
  const maxFrp = Math.max(...frps);
  const minFrp = Math.min(...frps);

  const nightCount = dets.filter(p => p.daynight === 'N').length;
  const dayCount = dets.filter(p => p.daynight === 'D').length;
  const nightRatio = nightCount / n;

  const sats = {};
  dets.forEach(p => { sats[p.satellite] = (sats[p.satellite] || 0) + 1; });

  // Explicit type distinction (Requirement D)
  const isMultiPass = n > 1;
  const eventType = isMultiPass ? 'MULTI_PASS_TRACKED_EVENT' : 'SINGLE_PASS_ANOMALY';

  let spatialConsistencyAssessment = 'UNKNOWN';
  if (!isMultiPass) {
    spatialConsistencyAssessment = 'SINGLE_OBSERVATION_NO_DRIFT_EVALUATION';
  } else if (meanNormalizedDrift <= 1.0) {
    spatialConsistencyAssessment = 'STATIONARY_POINT_SOURCE (Drift fully within satellite pixel footprint)';
  } else if (meanNormalizedDrift <= 1.6) {
    spatialConsistencyAssessment = 'MODERATE_DISPERSION (Possible multi-stack cluster or local spread)';
  } else {
    spatialConsistencyAssessment = 'EXPANDING_FRONT (Drift significantly exceeds sensor optical footprint)';
  }

  return {
    event_id: cluster.eventId,
    event_type: eventType,
    region: cluster.regionTag,
    spatio_temporal: {
      centroid: { latitude: Number(cLat.toFixed(5)), longitude: Number(cLon.toFixed(5)) },
      observation_count: n,
      active_days: isMultiPass ? activeDays : 1,
      duration_hours: Number(durationHours.toFixed(1)),
      first_detected: firstDt.toISOString(),
      last_detected: lastDt.toISOString(),
      day_night: { day: dayCount, night: nightCount },
      night_ratio: Number(nightRatio.toFixed(2))
    },
    spatial_diagnostics: {
      raw_max_drift_meters: Number(maxDrift.toFixed(1)),
      raw_mean_drift_meters: Number(meanDrift.toFixed(1)),
      normalized_optical_drift_ratio: Number(meanNormalizedDrift.toFixed(2)),
      spatial_consistency: spatialConsistencyAssessment
    },
    thermal_diagnostics: {
      min_frp_mw: Number(minFrp.toFixed(2)),
      mean_frp_mw: Number(meanFrp.toFixed(2)),
      max_frp_mw: Number(maxFrp.toFixed(2))
    },
    sensor_composition: sats,
    uncertainty: {
      level: isMultiPass ? 'MODERATE' : 'HIGH',
      caveat: isMultiPass
        ? 'Drift metrics normalized by VIIRS scan/track footprint dimensions.'
        : 'Single observation detection. Cannot evaluate temporal persistence, spatial drift, or operational stability without subsequent passes.'
    }
  };
}

// ============================================================================
// MAIN EXECUTION & METRIC COMPARISON
// ============================================================================
function run() {
  const csvPath = path.join('prototype', 'data', 'processed', 'firms_real_sample_3regions.csv');
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split(/\r?\n/);
  const header = lines[0].split(',');

  const detections = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length < header.length) continue;
    detections.push({
      lat: parseFloat(row[0]),
      lon: parseFloat(row[1]),
      bright_ti4: parseFloat(row[2]),
      scan: parseFloat(row[3]),
      track: parseFloat(row[4]),
      acq_date: row[5],
      acq_time: row[6],
      satellite: row[7],
      confidence: row[8],
      bright_ti5: parseFloat(row[10]),
      frp: parseFloat(row[11]),
      daynight: row[12].trim(),
      region_tag: row[13].trim(),
      datetime: parseFirmsDatetime(row[5], row[6])
    });
  }

  console.log(`[Phase 1.1] Loaded ${detections.length} real detections from ${csvPath}`);
  console.log(`[Config] Base R = ${CONFIG.BASE_SPATIAL_RADIUS_METERS}m, ΔT = ${CONFIG.TEMPORAL_WINDOW_HOURS}h, FootprintScaling = ${CONFIG.ENABLE_FOOTPRINT_SCALING}\n`);

  const clusters = aggregateDetectionsV2(detections, CONFIG);
  const events = clusters.map(characterizeEvent);

  // Save V2 events to JSON
  const outEventsPath = path.join('prototype', 'data', 'processed', 'aggregated_thermal_events_v2.json');
  fs.writeFileSync(outEventsPath, JSON.stringify(events, null, 2), 'utf8');
  console.log(`Saved ${events.length} V2 events to ${outEventsPath}\n`);

  // Compute Metrics
  const singleObs = events.filter(e => e.spatio_temporal.observation_count === 1);
  const multiObs = events.filter(e => e.spatio_temporal.observation_count > 1);
  const multiDay = events.filter(e => e.spatio_temporal.active_days > 1);

  console.log('=================================================================');
  console.log('                 AGGREGATION V2 METRICS SUMMARY                  ');
  console.log('=================================================================');
  console.log(`Total Events: ${events.length}`);
  console.log(`Single-Pass Anomalies: ${singleObs.length} (${((singleObs.length / events.length) * 100).toFixed(1)}%)`);
  console.log(`Multi-Pass Tracked Events: ${multiObs.length} (${((multiObs.length / events.length) * 100).toFixed(1)}%)`);
  console.log(`Multi-Day Persistent Events: ${multiDay.length} (${((multiDay.length / events.length) * 100).toFixed(1)}%)`);

  // Detailed Regional Case Inspections
  console.log('\n=================================================================');
  console.log('                KEY CASE STUDY INSPECTION (V2)                   ');
  console.log('=================================================================');

  // Inspect Hazira Events (Region: gujarat_industrial, lat ~ 21.1)
  const haziraEvents = events.filter(e =>
    e.region === 'gujarat_industrial' &&
    Math.abs(e.spatio_temporal.centroid.latitude - 21.1) < 0.2
  );
  console.log(`\n--- [HAZIRA PETROCHEMICAL HUB] Events Formed: ${haziraEvents.length} ---`);
  haziraEvents.forEach(e => {
    console.log(`ID: ${e.event_id} | Type: ${e.event_type} | Obs: ${e.spatio_temporal.observation_count} (Days: ${e.spatio_temporal.active_days})`);
    console.log(`  Centroid: [${e.spatio_temporal.centroid.latitude}, ${e.spatio_temporal.centroid.longitude}]`);
    console.log(`  Raw Max Drift: ${e.spatial_diagnostics.raw_max_drift_meters}m | Optical Ratio: ${e.spatial_diagnostics.normalized_optical_drift_ratio}`);
    console.log(`  Assessment: ${e.spatial_diagnostics.spatial_consistency}`);
    console.log(`  FRP: Mean ${e.thermal_diagnostics.mean_frp_mw} MW | Max ${e.thermal_diagnostics.max_frp_mw} MW`);
  });

  // Inspect Panipat Events (Region: punjab_agriculture, lat ~ 29.47, lon ~ 76.86)
  const panipatEvents = events.filter(e =>
    Math.abs(e.spatio_temporal.centroid.latitude - 29.475) < 0.05 &&
    Math.abs(e.spatio_temporal.centroid.longitude - 76.86) < 0.05
  );
  console.log(`\n--- [IOCL PANIPAT REFINERY] Events Formed: ${panipatEvents.length} ---`);
  panipatEvents.forEach(e => {
    console.log(`ID: ${e.event_id} | Type: ${e.event_type} | Obs: ${e.spatio_temporal.observation_count} (Days: ${e.spatio_temporal.active_days})`);
    console.log(`  Centroid: [${e.spatio_temporal.centroid.latitude}, ${e.spatio_temporal.centroid.longitude}]`);
    console.log(`  Raw Max Drift: ${e.spatial_diagnostics.raw_max_drift_meters}m | Optical Ratio: ${e.spatial_diagnostics.normalized_optical_drift_ratio}`);
    console.log(`  Assessment: ${e.spatial_diagnostics.spatial_consistency}`);
    console.log(`  Night Ratio: ${(e.spatio_temporal.night_ratio * 100).toFixed(0)}%`);
  });
}

run();
