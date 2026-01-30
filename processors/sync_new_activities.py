from tqdm import tqdm
import time
import colorama

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import SessionLocal
from database.queries import get_last_activity_timestamp
from database.models import Activity

from collector.activities import get_all_activities
from collector.activities import get_activity_by_id
from collector.streams import fetch_activity_streams

from processors.activities import map_activity_to_db_model
from processors.streams import map_streams_to_db_model
from processors.splits import map_splits_to_db_model

from utils.constants import STREAM_WORKOUT_TYPES

colorama.init(autoreset=True)

def sync_new_activities():
    session = SessionLocal()
    last_ts = get_last_activity_timestamp()
    summary_activities = get_all_activities(after=last_ts)
    
    runs_to_process = [s for s in summary_activities if s.get("type") == "Run"]
    
    saved_count = 0
    errors_count = 0
    
    pbar = tqdm(runs_to_process, desc="Starting synchronization", unit="atv", colour="cyan")
    
    for summary in pbar:
        pbar.set_description(f"Processing: {summary.get("name")[:25]}")
        
        exists = (
            session.query(Activity)
            .filter_by(id=summary["id"])
            .first()
        )
        if exists:
            pbar.set_postfix(status="Activity already exists")
            continue
        
        try:
            full_data = get_activity_by_id(summary["id"])
            activity_obj = map_activity_to_db_model(full_data)
            session.add(activity_obj)
            session.flush()
            
            if activity_obj.workout_type in STREAM_WORKOUT_TYPES:
                pbar.set_postfix(status="Downloading Streams", last_id=summary["id"])
                streams = fetch_activity_streams(activity_obj.id)
                streams_obj = map_streams_to_db_model(activity_obj.id, streams)
                session.add_all(streams_obj)
            else:
                pbar.set_postfix(status="Downloading Splits", last_id=summary["id"])
                splits_data = full_data.get("splits_metric", [])
                splits_obj = map_splits_to_db_model(activity_obj.id, splits_data)
                session.add_all(splits_obj)
            
            session.commit()
            saved_count += 1
            time.sleep(10)
        
        except Exception as e:
            errors_count += 1
            pbar.write(f"Error in the activity: {summary["id"]}: {e}")
            session.rollback()
        
    pbar.colour = "green"
    pbar.set_description("Sync completed")
    pbar.refresh()
    session.close()
    print(f"{saved_count} new activities were saved, {errors_count} errors")
                