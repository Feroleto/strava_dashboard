import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import ActivitySplit

def map_splits_to_db_model(activity_id, splits):
    for s in splits:
        dist_raw = s.get("distance", 0)
        moving_time_sec = s.get("moving_time", 0)
        dist_km = dist_raw / 1000
        
        if dist_km > 0:
            pace_min_km = (moving_time_sec / 60) / dist_km
        else:
            pace_min_km = 0.0
            
        yield ActivitySplit(
            activity_id=activity_id,
            split_index=s["split"],
            distance_km=dist_km,
            moving_time_sec=moving_time_sec,
            pace_min_km=pace_min_km
        )
        