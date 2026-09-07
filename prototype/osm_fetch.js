/**
 * Industrial Fire Intelligence - Phase 2 OSM Extraction
 * Queries Overpass API once for the 3 target demo regions (Hazira, Panipat, Simlipal)
 * and caches the raw JSON directly to disk. Zero live Overpass queries during judging.
 */

const fs = require('fs');
const path = require('path');

const REGIONS = [
  { name: 'hazira_industrial', bbox: '21.05,72.60,21.20,72.75' },
  { name: 'panipat_industrial', bbox: '29.40,76.80,29.55,76.95' },
  { name: 'simlipal_reserve', bbox: '20.75,84.90,21.05,85.20' }
];

async function fetchOsmRegion(region) {
  const query = `[out:json][timeout:30];
(
  nwr["landuse"="industrial"](${region.bbox});
  nwr["industrial"](${region.bbox});
  nwr["man_made"="works"](${region.bbox});
  nwr["power"="plant"](${region.bbox});
  nwr["leisure"="nature_reserve"](${region.bbox});
  nwr["boundary"="national_park"](${region.bbox});
);
out center;`;

  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
  console.log(`[OSM Extractor] Querying Overpass API for: ${region.name} (${region.bbox})...`);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'IndustrialFireIntelligence/1.0 (nikhilbiju; student research)' }
  });

  if (!response.ok) {
    throw new Error(`Overpass API responded with HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  const count = json.elements ? json.elements.length : 0;
  console.log(`[OSM Extractor] ${region.name}: Retrieved ${count} real OSM elements.`);
  return json;
}

async function main() {
  const rawDir = path.join(__dirname, 'data', 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  for (const region of REGIONS) {
    try {
      const data = await fetchOsmRegion(region);
      const outPath = path.join(rawDir, `osm_${region.name}.json`);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[OSM Extractor] Saved: ${outPath}`);
    } catch (err) {
      console.error(`[OSM Extractor] Error fetching ${region.name}:`, err.message);
    }
    // Respect Overpass rate limits between queries
    await new Promise(r => setTimeout(r, 2000));
  }
}

main();
