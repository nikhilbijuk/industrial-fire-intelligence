/**
 * Industrial Fire Intelligence - Phase 1 Real Data Validation
 * Pure Spatio-Temporal Event Aggregation on Real NASA FIRMS VIIRS (NOAA-20 / NOAA-21).
 * NO CLASSIFICATION, NO CONFIDENCE SCORES. Pure physical event aggregation & diagnostics.
 */

const fs = require('fs');
const path = require('path');

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000.0; // Earth radius in meters
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

function clusterFirmsDetections(detections, spatialRadiusM = 800.0, temporalWindowHours = 72.0) {
  // Sort detections strictly chronologically
  const sorted = [...detections].sort((a, b) => a.datetime - b.datetime);
  const clusters = [];

  for (const det of sorted) {
    let matchedCluster = null;
    for (const cluster of clusters) {
      // Check spatial distance against all points within the temporal window
      for (let i = cluster.length - 1; i >= 0; i--) {
        const pt = cluster[i];
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

function analyzeClusters(clusters) {
  const eventSummaries = [];

  for (let idx = 0; idx < clusters.length; idx++) {
    const cluster = clusters[idx];
    const n = cluster.length;
    const cLat = cluster.reduce((sum, p) => sum + p.lat, 0) / n;
    const cLon = cluster.reduce((sum, p) => sum + p.lon, 0) / n;

    const drifts = cluster.map(p => haversineDistanceMeters(cLat, cLon, p.lat, p.lon));
    const maxDrift = Math.max(...drifts);
    const meanDrift = drifts.reduce((a, b) => a + b, 0) / n;

    const firstDt = cluster[0].datetime;
    const lastDt = cluster[cluster.length - 1].datetime;
    const durationHours = (lastDt - firstDt) / (1000 * 3600);

    const uniqueDays = new Set(cluster.map(p => p.datetime.toISOString().split('T')[0]));
    const activeDays = uniqueDays.size;

    const frps = cluster.map(p => p.frp);
    const meanFrp = frps.reduce((a, b) => a + b, 0) / n;
    const maxFrp = Math.max(...frps);
    const minFrp = Math.min(...frps);

    const nightCount = cluster.filter(p => p.daynight === 'N').length;
    const dayCount = cluster.filter(p => p.daynight === 'D').length;

    const sats = {};
    cluster.forEach(p => { sats[p.satellite] = (sats[p.satellite] || 0) + 1; });

    const regions = {};
    cluster.forEach(p => { regions[p.region_tag] = (regions[p.region_tag] || 0) + 1; });

    eventSummaries.push({
      event_id: `EVT-REAL-${String(idx + 1).padStart(4, '0')}`,
      observation_count: n,
      active_days: activeDays,
      duration_hours: Number(durationHours.toFixed(1)),
      first_detected: firstDt.toISOString(),
      last_detected: lastDt.toISOString(),
      centroid: { latitude: Number(cLat.toFixed(5)), longitude: Number(cLon.toFixed(5)) },
      spatial_metrics: {
        max_drift_meters: Number(maxDrift.toFixed(1)),
        mean_drift_meters: Number(meanDrift.toFixed(1))
      },
      thermal_metrics: {
        min_frp_mw: Number(minFrp.toFixed(2)),
        mean_frp_mw: Number(meanFrp.toFixed(2)),
        max_frp_mw: Number(maxFrp.toFixed(2))
      },
      sensor_composition: sats,
      day_night: { day: dayCount, night: nightCount },
      region: Object.keys(regions)[0]
    });
  }

  return eventSummaries;
}

function run() {
  const csvPath = path.join('prototype', 'data', 'processed', 'firms_real_sample_3regions.csv');
  console.log('Loading real data from:', csvPath);
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

  console.log(`Loaded ${detections.length} real satellite detections.`);
  
  // Cluster with baseline hypothesis: R = 800m, ΔT = 72 hours
  const clusters = clusterFirmsDetections(detections, 800.0, 72.0);
  const events = analyzeClusters(clusters);

  console.log(`Aggregated into ${events.length} physical Thermal Events.`);

  // Save processed events to JSON for inspection
  const outEventsPath = path.join('prototype', 'data', 'processed', 'aggregated_thermal_events.json');
  fs.writeFileSync(outEventsPath, JSON.stringify(events, null, 2), 'utf8');
  console.log(`Saved aggregated events to ${outEventsPath}\n`);

  // Print Detailed Diagnostic Breakdown
  const multiObs = events.filter(e => e.observation_count > 1);
  const singleObs = events.filter(e => e.observation_count === 1);
  const persistentMultiDay = events.filter(e => e.active_days > 1);

  console.log('--- EVENT AGGREGATION DIAGNOSTICS ---');
  console.log(`Total Events: ${events.length}`);
  console.log(`Single-Observation Events: ${singleObs.length} (${((singleObs.length / events.length) * 100).toFixed(1)}%)`);
  console.log(`Multi-Observation Events: ${multiObs.length} (${((multiObs.length / events.length) * 100).toFixed(1)}%)`);
  console.log(`Multi-Day Persistent Events: ${persistentMultiDay.length} (${((persistentMultiDay.length / events.length) * 100).toFixed(1)}%)`);

  console.log('\n--- TOP 5 MULTI-OBSERVATION THERMAL EVENTS ---');
  const sortedMulti = [...multiObs].sort((a, b) => b.observation_count - a.observation_count);
  sortedMulti.slice(0, 5).forEach(e => {
    console.log(`ID: ${e.event_id} | Region: ${e.region}`);
    console.log(`  Centroid: [${e.centroid.latitude}, ${e.centroid.longitude}]`);
    console.log(`  Observations: ${e.observation_count} across ${e.active_days} active days (Duration: ${e.duration_hours}h)`);
    console.log(`  Spatial Drift: Max ${e.spatial_metrics.max_drift_meters}m | Mean ${e.spatial_metrics.mean_drift_meters}m`);
    console.log(`  FRP: Mean ${e.thermal_metrics.mean_frp_mw} MW | Max ${e.thermal_metrics.max_frp_mw} MW`);
    console.log(`  Passes: Day ${e.day_night.day}, Night ${e.day_night.night} | Satellites: ${JSON.stringify(e.sensor_composition)}`);
    console.log('');
  });
}

run();
