/**
 * Industrial Fire Intelligence - Thermal Event Aggregator & Intelligence Prototype
 * Converts raw NASA FIRMS satellite detections into Spatio-Temporal Thermal Events,
 * enriches them with geographic context, and computes explainable evidence scoring.
 * Executable under Node.js (v25+)
 */

const fs = require('fs');
const path = require('path');

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000.0; // Earth's radius in meters
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
  const paddedTime = timeStr.padStart(4, '0');
  const hours = paddedTime.substring(0, 2);
  const minutes = paddedTime.substring(2, 4);
  return new Date(`${dateStr}T${hours}:${minutes}:00Z`);
}

function clusterFirmsDetections(detections, spatialRadiusM = 800.0, temporalWindowHours = 72.0) {
  const sorted = [...detections].sort((a, b) => a.datetime - b.datetime);
  const clusters = [];

  for (const det of sorted) {
    let matchedCluster = null;
    for (const cluster of clusters) {
      // Check proximity with recent observations in cluster
      const recentPoints = cluster.slice(-5);
      for (const pt of recentPoints) {
        const timeDiffHours = Math.abs(det.datetime - pt.datetime) / (1000 * 3600);
        if (timeDiffHours <= temporalWindowHours) {
          const distM = haversineDistanceMeters(det.lat, det.lon, pt.lat, pt.lon);
          if (distM <= spatialRadiusM) {
            matchedCluster = cluster;
            break;
          }
        }
      }
      if (matchedCluster) break;
    }

    if (matchedCluster) {
      matchedCluster.push(det);
    } else {
      clusters.push([det]);
    }
  }

  return clusters;
}

const KNOWN_FACILITIES = [
  { name: 'IOCL Panipat Refinery Complex', type: 'oil_refinery', lat: 29.4720, lon: 76.8715, landcover: 'Built-up / Industrial' },
  { name: 'Simlipal National Park Core', type: 'protected_forest', lat: 21.8500, lon: 86.3500, landcover: 'Dense Tree Cover' }
];

function getContextualEnrichment(lat, lon) {
  let closestFac = null;
  let minDist = Infinity;

  for (const fac of KNOWN_FACILITIES) {
    const d = haversineDistanceMeters(lat, lon, fac.lat, fac.lon);
    if (d < minDist) {
      minDist = d;
      closestFac = fac;
    }
  }

  if (closestFac && minDist <= 1500.0) {
    return {
      landcover_class: closestFac.landcover,
      nearest_facility_name: closestFac.name,
      facility_type: closestFac.type,
      distance_to_facility_meters: Math.round(minDist * 10) / 10
    };
  } else {
    return {
      landcover_class: 'Cropland / Open Vegetation',
      nearest_facility_name: 'None Detected (< 1.5 km)',
      facility_type: 'none',
      distance_to_facility_meters: Math.round((minDist === Infinity ? 9999.0 : minDist) * 10) / 10
    };
  }
}

function evaluateThermalEvent(cluster, eventIndex) {
  const n = cluster.length;
  const cLat = cluster.reduce((sum, p) => sum + p.lat, 0) / n;
  const cLon = cluster.reduce((sum, p) => sum + p.lon, 0) / n;

  const drifts = cluster.map(p => haversineDistanceMeters(cLat, cLon, p.lat, p.lon));
  const maxDrift = Math.max(...drifts);

  const firstDt = cluster[0].datetime;
  const lastDt = cluster[cluster.length - 1].datetime;

  const uniqueDays = new Set(cluster.map(p => p.datetime.toISOString().split('T')[0]));
  const activeDays = uniqueDays.size;

  const frps = cluster.map(p => p.frp);
  const meanFrp = frps.reduce((a, b) => a + b, 0) / n;
  const maxFrp = Math.max(...frps);

  const nightCount = cluster.filter(p => p.daynight === 'N').length;
  const nightRatio = nightCount / n;

  const context = getContextualEnrichment(cLat, cLon);
  const distM = context.distance_to_facility_meters;
  const landcover = context.landcover_class;

  const supportingEvidence = [];
  const counterEvidence = [];

  // Evidence Scoring Rules
  if (distM <= 500.0 && context.facility_type !== 'protected_forest') {
    supportingEvidence.push({
      factor: 'Industrial Proximity',
      description: `Event centroid is ${distM.toFixed(0)}m from ${context.nearest_facility_name}`,
      weight: 0.35
    });
  } else if (distM > 2000.0) {
    counterEvidence.push({
      factor: 'Facility Absence',
      description: `No industrial facility detected within 2km buffer (nearest is ${distM.toFixed(0)}m)`,
      weight: -0.25
    });
  }

  if (activeDays >= 2 && maxDrift < 100.0) {
    supportingEvidence.push({
      factor: 'Spatial Persistence & Stability',
      description: `Detected over ${activeDays} distinct days with negligible centroid drift (${maxDrift.toFixed(1)}m)`,
      weight: 0.30
    });
  } else if (maxDrift > 400.0) {
    supportingEvidence.push({
      factor: 'Expanding Spatial Front',
      description: `Significant spatial spread (${maxDrift.toFixed(1)}m drift) indicates propagating fire perimeter`,
      weight: 0.30
    });
  }

  if (nightRatio > 0.35) {
    supportingEvidence.push({
      factor: 'Continuous 24/7 Combustion',
      description: `${(nightRatio * 100).toFixed(0)}% of passes recorded at night, consistent with industrial emissions`,
      weight: 0.20
    });
  } else if (nightRatio === 0.0 && activeDays <= 2) {
    supportingEvidence.push({
      factor: 'Diurnal Daylight Restriction',
      description: 'Exclusively daytime thermal activity during harvest window, characteristic of crop residue clearing',
      weight: 0.25
    });
  }

  let domain, subclass, confidence, priority;

  if (distM <= 600.0 && context.facility_type !== 'protected_forest') {
    domain = 'INDUSTRIAL';
    if (activeDays >= 2 && maxDrift < 120.0) {
      subclass = 'PERSISTENT_OPERATIONAL_SOURCE';
      confidence = 0.92;
      priority = 'MEDIUM';
    } else {
      subclass = 'ABNORMAL_INDUSTRIAL_FIRE';
      confidence = 0.84;
      priority = 'CRITICAL';
    }
  } else if (landcover.includes('Tree Cover') || (maxDrift > 300.0 && meanFrp > 35.0)) {
    domain = 'WILDFIRE';
    subclass = 'FOREST_CANOPY_FIRE';
    confidence = 0.89;
    priority = 'HIGH';
  } else {
    domain = 'AGRICULTURAL';
    subclass = 'CROP_RESIDUE_BURNING';
    confidence = 0.87;
    priority = 'LOW';
  }

  return {
    event_id: `EVT-2026-${domain.substring(0, 3)}-${String(eventIndex).padStart(4, '0')}`,
    spatio_temporal: {
      centroid: { latitude: Number(cLat.toFixed(5)), longitude: Number(cLon.toFixed(5)) },
      first_detected: firstDt.toISOString(),
      last_detected: lastDt.toISOString(),
      observation_count: n,
      active_days: activeDays,
      spatial_drift_meters: Number(maxDrift.toFixed(1)),
      mean_frp_mw: Number(meanFrp.toFixed(1)),
      max_frp_mw: Number(maxFrp.toFixed(1)),
      night_ratio: Number(nightRatio.toFixed(2))
    },
    context,
    classification: {
      domain,
      subclass,
      confidence
    },
    evidence_breakdown: {
      supporting_evidence: supportingEvidence,
      counter_evidence: counterEvidence
    },
    uncertainty: {
      attribution_level: distM < 350.0 ? 'HIGH' : 'MEDIUM',
      cloud_obscuration_risk: 'MINIMAL',
      caveats: [
        'VIIRS 375m pixel centroid encompasses multiple sub-pixel features; attribution represents high-probability association.'
      ]
    },
    priority
  };
}

function main() {
  const csvPath = path.join(__dirname, 'firms_sample.csv');
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
      frp: parseFloat(row[12]),
      daynight: row[13].trim(),
      datetime: parseFirmsDatetime(row[5], row[6])
    });
  }

  console.log(`Loaded ${detections.length} raw satellite detections from ${csvPath}`);
  const clusters = clusterFirmsDetections(detections, 800.0, 72.0);
  console.log(`Aggregated into ${clusters.length} distinct Spatio-Temporal Thermal Events\n`);

  clusters.forEach((cluster, idx) => {
    const result = evaluateThermalEvent(cluster, idx + 1);
    console.log('='.repeat(65));
    console.log(`EVENT: ${result.event_id} -> ${result.classification.domain} (${result.classification.subclass})`);
    console.log(`Confidence: ${(result.classification.confidence * 100).toFixed(0)}% | Priority: ${result.priority}`);
    console.log(`Centroid: [${result.spatio_temporal.centroid.latitude}, ${result.spatio_temporal.centroid.longitude}] | Observations: ${result.spatio_temporal.observation_count} | Active Days: ${result.spatio_temporal.active_days}`);
    console.log(`Context: ${result.context.nearest_facility_name} (${result.context.distance_to_facility_meters}m)`);
    console.log('Supporting Evidence:');
    result.evidence_breakdown.supporting_evidence.forEach(e => console.log(`  + [${e.factor}] ${e.description}`));
    if (result.evidence_breakdown.counter_evidence.length > 0) {
      console.log('Counter Evidence:');
      result.evidence_breakdown.counter_evidence.forEach(c => console.log(`  - [${c.factor}] ${c.description}`));
    }
    console.log('='.repeat(65) + '\n');
  });
}

main();
