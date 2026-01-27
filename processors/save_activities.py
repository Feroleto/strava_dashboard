from datetime import datetime

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from collector.activities import get_all_activities
from database.models import Activity
from database.config import SessionLocal
from database.queries import get_last_activity_timestamp
from processors.activity_classifier import classify_workout
    
def map_strava_to_model(activity):
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
        workout_type=workout_type,
    )
    
def save_activities_to_db():
    session = SessionLocal()
    
    last_ts = get_last_activity_timestamp()
    
    activities = get_all_activities(after=last_ts)
    
    saved = 0
    
    for a in activities:
        exists = session.query(Activity).filter_by(id=a["id"]).first()
        if not exists:
            activity_obj = map_strava_to_model(a)
            session.add(activity_obj)
            saved += 1
        
    session.commit()
    session.close()
    print(f"{saved} new activities were saved")
            
if __name__ == "__main__":
    save_activities_to_db()


    
        