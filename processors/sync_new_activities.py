from tqdm import tqdm
import time

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import SessionLocal
from database.queries import get_last_activity_timestamp
from collector.activities import get_all_activities
from auth.token_manager import get_valid_access_token
from database.models import Activity
from collector.activities import get_activity_by_id
from processors.save_activities import map_strava_to_model
from utils.constants import STREAM_WORKOUT_TYPES
from collector.streams import fetch_activity_streams
from processors.save_streams import save_activity_streams
from processors.save_splits import save_splits_of_one_activity_to_db


def sync_new_activities():
    session = SessionLocal()
    last_ts = get_last_activity_timestamp()
    summary_activities = get_all_activities(after=last_ts)
    
    saved_count = 0
    access_token = get_valid_access_token()
    
    for summary in tqdm(summary_activities, desc="syncing"):
        if summary.get("type") != "Run":
            continue
        
        exists = (
            session.query(Activity)
            .filter_by(id=summary["id"])
            .first()
        )
        if exists:
            continue
        
        try:
            full_data = get_activity_by_id(summary["id"])
            activity_obj = map_strava_to_model(full_data)
            session.add(activity_obj)
            session.flush()
            
            if activity_obj.workout_type in STREAM_WORKOUT_TYPES:
                print(f"Downloading streams for activity: {activity_obj.name}")
                streams = fetch_activity_streams(activity_obj.id, access_token)
                save_activity_streams(session, activity_obj, streams)
            else:
                print(f"Downloading splits for activity: {activity_obj.name}")
                splits = full_data.get("splits_metric", [])
                save_splits_of_one_activity_to_db(session, activity_obj, splits)
            
            session.commit()
            saved_count += 1
            time.sleep(1.5)
        
        except Exception as e:
            print(f"Error to process activity {summary["id"]}: {e}")
            session.rollback()
        
    session.close()
    print(f"{saved_count} new activities were saved")
                