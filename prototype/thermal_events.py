"""
Industrial Fire Intelligence - Thermal Event Aggregator & Intelligence Prototype
Converts raw NASA FIRMS satellite detections into Spatio-Temporal Thermal Events,
enriches them with context, and computes explainable evidence scoring.
"""

import csv
import json
import math
from datetime import datetime
from typing import List, Dict, Any

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two geographic coordinates in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    return 2.0 * R * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

def parse_firms_datetime(date_str: str, time_str: str) -> datetime:
    """Parse FIRMS acq_date ('YYYY-MM-DD') and acq_time ('HHMM') into UTC datetime."""
    time_str = time_str.zfill(4)
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H%M")

def cluster_firms_detections(detections: List[Dict[str, Any]], 
                             spatial_radius_m: float = 800.0, 
                             temporal_window_hours: float = 72.0) -> List[List[Dict[str, Any]]]:
    """
    Spatio-Temporal Aggregation (Windowed ST-Clustering).
    Groups raw detection pixels into coherent physical Thermal Events.
    """
    # Sort detections chronologically
    sorted_dets = sorted(detections, key=lambda d: d["datetime"])
    clusters: List[List[Dict[str, Any]]] = []

    for det in sorted_dets:
        matched_cluster = None
        for cluster in clusters:
            # Check proximity to recent points in the cluster
            for c_point in reversed(cluster[-5:]):  # Compare with recent points
                time_diff_hours = abs((det["datetime"] - c_point["datetime"]).total_seconds()) / 3600.0
                if time_diff_hours <= temporal_window_hours:
                    dist_m = haversine_distance_meters(det["lat"], det["lon"], c_point["lat"], c_point["lon"])
                    if dist_m <= spatial_radius_m:
                        matched_cluster = cluster
                        break
            if matched_cluster:
                break
        
        if matched_cluster is not None:
            matched_cluster.append(det)
        else:
            clusters.append([det])
            
    return clusters

# Mock Geospatial Context Store (in production, loaded from local PostGIS / OSM GeoPackage)
KNOWN_FACILITIES = [
    {"name": "IOCL Panipat Refinery Complex", "type": "oil_refinery", "lat": 29.4720, "lon": 76.8715, "landcover": "Built-up / Industrial"},
    {"name": "Simlipal National Park Core", "type": "protected_forest", "lat": 21.8500, "lon": 86.3500, "landcover": "Dense Tree Cover"}
]

def get_contextual_enrichment(lat: float, lon: float) -> Dict[str, Any]:
    """Retrieve nearest infrastructure and landcover classification."""
    closest_fac = None
    min_dist = float("inf")
    
    for fac in KNOWN_FACILITIES:
        d = haversine_distance_meters(lat, lon, fac["lat"], fac["lon"])
        if d < min_dist:
            min_dist = d
            closest_fac = fac
            
    if closest_fac and min_dist <= 1500.0:
        return {
            "landcover_class": closest_fac["landcover"],
            "nearest_facility_name": closest_fac["name"],
            "facility_type": closest_fac["type"],
            "distance_to_facility_meters": round(min_dist, 1)
        }
    else:
        # Default agricultural / open land fallback
        return {
            "landcover_class": "Cropland / Open Vegetation",
            "nearest_facility_name": "None Detected (< 1.5 km)",
            "facility_type": "none",
            "distance_to_facility_meters": round(min_dist if min_dist != float("inf") else 9999.0, 1)
        }

def evaluate_thermal_event(cluster: List[Dict[str, Any]], event_index: int) -> Dict[str, Any]:
    """Generate structured Evidence Object from a clustered thermal event."""
    n = len(cluster)
    c_lat = sum(p["lat"] for p in cluster) / n
    c_lon = sum(p["lon"] for p in cluster) / n
    
    # Calculate drift from centroid
    drifts = [haversine_distance_meters(c_lat, c_lon, p["lat"], p["lon"]) for p in cluster]
    max_drift = max(drifts)
    
    first_dt = cluster[0]["datetime"]
    last_dt = cluster[-1]["datetime"]
    active_days = len(set(p["datetime"].date() for p in cluster))
    
    frps = [p["frp"] for p in cluster]
    mean_frp = sum(frps) / n
    max_frp = max(frps)
    night_count = sum(1 for p in cluster if p["daynight"] == "N")
    night_ratio = night_count / float(n)
    
    context = get_contextual_enrichment(c_lat, c_lon)
    dist_m = context["distance_to_facility_meters"]
    landcover = context["landcover_class"]
    
    supporting_evidence = []
    counter_evidence = []
    
    # Intelligence Scoring Rules
    if dist_m <= 500.0 and context["facility_type"] != "protected_forest":
        supporting_evidence.append({
            "factor": "Industrial Proximity",
            "description": f"Event centroid is {dist_m:.0f}m from {context['nearest_facility_name']}",
            "weight": 0.35
        })
    elif dist_m > 2000.0:
        counter_evidence.append({
            "factor": "Facility Absence",
            "description": f"No industrial facility detected within 2km buffer (nearest is {dist_m:.0f}m)",
            "weight": -0.25
        })
        
    if active_days >= 3 and max_drift < 100.0:
        supporting_evidence.append({
            "factor": "Spatial Persistence & Stability",
            "description": f"Detected over {active_days} distinct days with negligible centroid drift ({max_drift:.1f}m)",
            "weight": 0.30
        })
    elif max_drift > 400.0:
        supporting_evidence.append({
            "factor": "Expanding Spatial Front",
            "description": f"Significant spatial spread ({max_drift:.1f}m drift) indicates propagating fire perimeter",
            "weight": 0.30
        })
        
    if night_ratio > 0.35:
        supporting_evidence.append({
            "factor": "Continuous 24/7 Combustion",
            "description": f"{night_ratio*100:.0f}% of passes recorded at night, consistent with industrial thermal emissions",
            "weight": 0.20
        })
    elif night_ratio == 0.0 and active_days <= 2:
        supporting_evidence.append({
            "factor": "Diurnal Daylight Restriction",
            "description": "Exclusively daytime thermal activity during harvest window, characteristic of crop residue clearing",
            "weight": 0.25
        })

    # Domain Classification Logic
    if dist_m <= 600.0 and context["facility_type"] != "protected_forest":
        domain = "INDUSTRIAL"
        if active_days >= 2 and max_drift < 120.0:
            subclass = "PERSISTENT_OPERATIONAL_SOURCE"
            confidence = 0.92
            priority = "MEDIUM"
        else:
            subclass = "ABNORMAL_INDUSTRIAL_FIRE"
            confidence = 0.84
            priority = "CRITICAL"
    elif "Tree Cover" in landcover or (max_drift > 300.0 and mean_frp > 35.0):
        domain = "WILDFIRE"
        subclass = "FOREST_CANOPY_FIRE"
        confidence = 0.89
        priority = "HIGH"
    else:
        domain = "AGRICULTURAL"
        subclass = "CROP_RESIDUE_BURNING"
        confidence = 0.87
        priority = "LOW"

    return {
      "event_id": f"EVT-2026-{domain[:3]}-{event_index:04d}",
      "spatio_temporal": {
        "centroid": {"latitude": round(c_lat, 5), "longitude": round(c_lon, 5)},
        "first_detected": first_dt.isoformat() + "Z",
        "last_detected": last_dt.isoformat() + "Z",
        "observation_count": n,
        "active_days": active_days,
        "spatial_drift_meters": round(max_drift, 1),
        "mean_frp_mw": round(mean_frp, 1),
        "max_frp_mw": round(max_frp, 1),
        "night_ratio": round(night_ratio, 2)
      },
      "context": context,
      "classification": {
        "domain": domain,
        "subclass": subclass,
        "confidence": confidence
      },
      "evidence_breakdown": {
        "supporting_evidence": supporting_evidence,
        "counter_evidence": counter_evidence
      },
      "uncertainty": {
        "attribution_level": "HIGH" if dist_m < 350.0 else "MEDIUM",
        "cloud_obscuration_risk": "MINIMAL",
        "caveats": [
          "VIIRS 375m pixel centroid encompasses multiple sub-pixel features; attribution represents high-probability association."
        ]
      },
      "priority": priority
    }

def main():
    csv_path = "prototype/firms_sample.csv"
    detections = []
    
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            detections.append({
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "frp": float(row["frp"]),
                "daynight": row["daynight"],
                "datetime": parse_firms_datetime(row["acq_date"], row["acq_time"])
            })

    print(f"Loaded {len(detections)} raw satellite detections from {csv_path}")
    clusters = cluster_firms_detections(detections, spatial_radius_m=800.0, temporal_window_hours=72.0)
    print(f"Aggregated into {len(clusters)} distinct Spatio-Temporal Thermal Events\n")

    for i, cluster in enumerate(clusters, 1):
        event_intelligence = evaluate_thermal_event(cluster, i)
        print("=" * 65)
        print(f"EVENT: {event_intelligence['event_id']} -> {event_intelligence['classification']['domain']} ({event_intelligence['classification']['subclass']})")
        print(f"Confidence: {event_intelligence['classification']['confidence']*100:.0f}% | Priority: {event_intelligence['priority']}")
        print(f"Centroid: {event_intelligence['spatio_temporal']['centroid']} | Observations: {event_intelligence['spatio_temporal']['observation_count']}")
        print(f"Context: {event_intelligence['context']['nearest_facility_name']} ({event_intelligence['context']['distance_to_facility_meters']}m)")
        print("Supporting Evidence:")
        for e in event_intelligence['evidence_breakdown']['supporting_evidence']:
            print(f"  + [{e['factor']}] {e['description']}")
        if event_intelligence['evidence_breakdown']['counter_evidence']:
            print("Counter Evidence:")
            for c in event_intelligence['evidence_breakdown']['counter_evidence']:
                print(f"  - [{c['factor']}] {c['description']}")
        print("=" * 65 + "\n")

if __name__ == "__main__":
    main()
