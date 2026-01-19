import time

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import SessionLocal
from database.models import ActivitySplit
from database.queries import get_activities_without_splits
from collector.splits import fetch_activity_splits
from auth.token_manager import get_valid_access_token

def save_splits_of_one_activity_to_db(session, activity_id, splits):
    for s in splits:
        dist_raw = s.get("distance", 0)
        moving_time_sec = s.get("moving_time", 0)
        dist_km = dist_raw / 1000
        
        if dist_km > 0:
            pace_min_km = (moving_time_sec / 60) / dist_km
        else:
            pace_min_km = 0.0
            
        split = ActivitySplit(
            activity_id=activity_id,
            split_index=s["split"],
            distance_km=dist_km,
            moving_time_sec=moving_time_sec,
            pace_min_km=pace_min_km
        )
        session.add(split)
        
def ingest_splits():
    access_token = get_valid_access_token()
    
    session = SessionLocal()
    
    try:
        activities = get_activities_without_splits(session)
        
        print(f"Fetching splits for {len(activities)} activities")
        
        for activity in activities:
            splits = fetch_activity_splits(activity.id, access_token)
            save_splits_of_one_activity_to_db(session, activity.id, splits)
            
            session.commit()
            time.sleep(1)
    finally:
        session.close()
        
if __name__ == "__main__":
    token = get_valid_access_token()
    ingest_splits(token)