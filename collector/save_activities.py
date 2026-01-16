from datetime import datetime
from zoneinfo import ZoneInfo
import time

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from collector.activities import get_activities, get_all_activities, fetch_activity_splits
from database.models import SessionLocal, Activity, ActivitySplit
from analysis.data_manager import get_activities_without_splits
from auth.token_manager import get_valid_access_token

SAO_PAULO_TZ = ZoneInfo("America/Sao_Paulo")

def save_activities():
    session = SessionLocal()
    
    activities = get_all_activities()
    saved = 0
    
    for a in activities:
        exists = session.query(Activity).filter_by(id=a["id"]).first()
        if exists:
            continue
        
        start_date_utc = datetime.fromisoformat(
            a["start_date"].replace("Z", "+00:00")
        )
        start_date_sp = start_date_utc.astimezone(SAO_PAULO_TZ)
        
        distance_km = a["distance"] / 1000 if a["distance"] else None
        moving_time_sec = a["moving_time"]
        pace_sec_per_km = (
            moving_time_sec / distance_km if distance_km else None
        )
        
        activity = Activity(
            id = a["id"],
            name = a["name"],
            type = a["type"],
            sport_type = a.get("sport_type"),
            start_date = datetime.fromisoformat(
                a["start_date"].replace("Z", "")
            ),
            distance_km = distance_km,
            moving_time_sec = moving_time_sec,
            pace_raw = pace_sec_per_km,
            elevation_gain = a.get("total_elevation_gain"),
            average_bpm = a.get("average_heartrate"),
            max_bpm = a.get("max_heartrate"),
        )
        
        session.add(activity)
        saved += 1
        
    session.commit()
    session.close()
    
    print(f"{saved} new activities saved")
    
    
def save_splits(session, activity_id, splits):
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
        
        
def ingest_splits(access_token):
    session = SessionLocal()
    
    try:
        activities = get_activities_without_splits(session)
        
        print(f"Fetching splits for {len(activities)} activities")
        
        for activity in activities:
            splits = fetch_activity_splits(activity.id, access_token)
            save_splits(session, activity.id, splits)
            
            session.commit()
            time.sleep(1)
    finally:
        session.close()
        
def main():
    token = get_valid_access_token()
    ingest_splits(token)
    
if __name__ == "__main__":
    #save_activities()
    main()


    
        