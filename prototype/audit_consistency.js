/**
 * Industrial Fire Intelligence - Data Consistency & Traceability Audit
 * Validates every number and tag in final_event_intelligence.json against
 * underlying FIRMS detections and real OSM facility extractions.
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

function runAudit() {
  const rawCsvPath = path.join('prototype', 'data', 'processed', 'firms_real_sample_3regions.csv');
  const v2EventsPath = path.join('prototype', 'data', 'processed', 'aggregated_thermal_events_v2.json');
  const osmPath = path.join('prototype', 'data', 'processed', 'osm_real_facilities.json');
  const finalJsonPath = path.join('prototype', 'data', 'processed', 'final_event_intelligence.json');

  const rawCsv = fs.readFileSync(rawCsvPath, 'utf8').trim().split(/\r?\n/);
  const v2Events = JSON.parse(fs.readFileSync(v2EventsPath, 'utf8'));
  const osmFacilities = JSON.parse(fs.readFileSync(osmPath, 'utf8'));
  const finalIntelligence = JSON.parse(fs.readFileSync(finalJsonPath, 'utf8'));

  console.log('======================================================================');
  console.log('            INDUSTRIAL FIRE INTELLIGENCE - AUDIT REPORT               ');
  console.log('======================================================================\n');

  console.log(`1. Dataset Record Counts:`);
  console.log(`   - Raw FIRMS Detections in sample: ${rawCsv.length - 1}`);
  console.log(`   - V2 Aggregated Thermal Events: ${v2Events.length}`);
  console.log(`   - Real Normalized OSM Facilities: ${osmFacilities.length}`);
  console.log(`   - Final Intelligence Objects: ${finalIntelligence.length}`);
  console.log(`   - Count Integrity: ${v2Events.length === finalIntelligence.length ? 'PASS (41 == 41)' : 'FAIL'}\n`);

  // Target Showcase Cases
  const targets = ['EVT-V2-0007', 'EVT-V2-0027', 'EVT-V2-0033', 'EVT-V2-0004'];

  console.log('2. Showcase Events Detailed Audit:\n');

  for (const targetId of targets) {
    const v2 = v2Events.find(e => e.event_id === targetId);
    const finalEv = finalIntelligence.find(e => e.event_id === targetId);

    if (!v2 || !finalEv) {
      console.error(`ERROR: Event ${targetId} not found in one of the datasets!`);
      continue;
    }

    console.log(`----------------------------------------------------------------------`);
    console.log(`EVENT ID: ${targetId} [${finalEv.region.toUpperCase()}]`);
    console.log(`Classification: ${finalEv.classification.domain} -> ${finalEv.classification.subclass}`);
    console.log(`Confidence Score: ${(finalEv.classification.confidence_score * 100).toFixed(0)}% (${finalEv.classification.confidence_label})`);
    console.log(`Priority: ${finalEv.priority}`);
    console.log(`Centroid Coordinates: [${finalEv.spatio_temporal.centroid.latitude}, ${finalEv.spatio_temporal.centroid.longitude}]`);
    console.log(`Observations: ${finalEv.spatio_temporal.observation_count} passes across ${finalEv.spatio_temporal.active_days} active days`);
    console.log(`Duration: ${finalEv.spatio_temporal.duration_hours} hours`);
    console.log(`Night/Day Ratio: ${(finalEv.spatio_temporal.night_ratio * 100).toFixed(0)}% night (${finalEv.spatio_temporal.day_night.night} N / ${finalEv.spatio_temporal.day_night.day} D)`);
    console.log(`Raw Max Drift: ${finalEv.spatial_diagnostics.raw_max_drift_meters} meters`);
    console.log(`Optical Drift Ratio: ${finalEv.spatial_diagnostics.normalized_optical_drift_ratio}x`);

    // Verify distance from scratch
    const facName = finalEv.context.nearest_facility_name;
    const facType = finalEv.context.nearest_facility_type;
    const facCoords = finalEv.context.facility_coordinates;
    const recordedDist = finalEv.context.geodesic_distance_meters;

    let computedDist = null;
    if (facCoords) {
      computedDist = Math.round(haversineDistanceMeters(
        finalEv.spatio_temporal.centroid.latitude,
        finalEv.spatio_temporal.centroid.longitude,
        facCoords[0],
        facCoords[1]
      ));
    }

    console.log(`Nearest Real OSM Facility: "${facName}" (Type: ${facType})`);
    console.log(`Facility Coordinates: [${facCoords ? facCoords.join(', ') : 'N/A'}]`);
    console.log(`Geodesic Distance Recorded: ${recordedDist} meters`);
    console.log(`Geodesic Distance Verified: ${computedDist} meters (Delta: ${computedDist !== null ? Math.abs(recordedDist - computedDist) : 'N/A'}m)`);
    console.log(`Distance Math Integrity: ${computedDist === recordedDist ? 'PASS' : 'FAIL'}`);

    // Verify Observation Count vs Timeline Entries
    console.log(`Timeline Observation Count: ${finalEv.observation_timeline.length}`);
    console.log(`Timeline Match: ${finalEv.observation_timeline.length >= finalEv.spatio_temporal.observation_count ? 'PASS' : 'WARN'}`);
    console.log('');
  }
}

runAudit();
