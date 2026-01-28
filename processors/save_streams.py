import time
from tqdm import tqdm

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import ActivitySecond
from database.config import SessionLocal
from collector.streams import fetch_activity_streams
from database.queries import get_activities_requiring_streams, activity_has_streams

def save_activity_streams(session, activity, streams):
    time_stream = streams["time"]["data"]
    distance_stream = streams["distance"]["data"]
    speed_stream = streams.get("velocity_smooth", {}).get("data", [])
    hr_stream = streams.get("heartrate", {}).get("data", [])
    alt_stream = streams.get("altitude", {}).get("data", [])
    
    for i in range(len(time_stream)):
        speed = speed_stream[i] if (speed_stream and i < len(speed_stream)) else None
        sec = ActivitySecond(
            activity_id=activity.id,
            second_index=time_stream[i],
            distance_m=distance_stream[i],
            speed_m_s=speed,
            heart_rate=hr_stream[i] if i < len(hr_stream) else None,
            elevation_m=alt_stream[i] if i < len(alt_stream) else None,
            pace_sec_km=(1000 / speed) if (speed and speed > 0) else None
        )
        
        session.add(sec)
        
def ingest_streams():
    session = SessionLocal()
    
    try:
        activities = get_activities_requiring_streams(session)
        
        if not activities:
            print("You have already collected all streams")
            return
        
        for activity in tqdm(activities, desc="Downloading streams", unit="atv"):
            
            if activity_has_streams(session, activity.id):
                continue
            
            try:
                streams = fetch_activity_streams(activity.id)
                
                save_activity_streams(
                    session=session,
                    activity=activity,
                    streams=streams
                )
                
                session.commit()
                time.sleep(1)
            
            except Exception as e:
                print(f"Error in the activity: {activity.id}: {e}")
                session.rollback()
                continue
        
    except Exception as e:
        session.rollback()
        print("Error: ", e)
        
    finally:
        session.close()
        
def main():
    ingest_streams()
    
if __name__ == "__main__":
    main()