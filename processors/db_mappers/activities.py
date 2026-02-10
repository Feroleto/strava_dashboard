from datetime import datetime

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import Activity
from processors.activity_classifier import classify_workout
    
def map_activity_to_db_model(activity):
    distance_km = activity["distance"] / 1000 if activity["distance"] else None
    moving_time_sec = activity["moving_time"]
    pace_sec_per_km = moving_time_sec / distance_km if distance_km else None
    
    workout_type = classify_workout(activity)
    
    return Activity(
        id = activity["id"],
        name = activity["name"],
        type = activity["type"],
        sport_type = activity.get("sport_type"),
        start_date = datetime.fromisoformat(
            activity["start_date"].replace("Z", "")
        ),
        distance_km = distance_km,
        moving_time_sec = moving_time_sec,
        pace_raw = pace_sec_per_km,
        elevation_gain = activity.get("total_elevation_gain"),
        average_bpm = activity.get("average_heartrate"),
        max_bpm = activity.get("max_heartrate"),
        workout_type = workout_type,
    )


    
        