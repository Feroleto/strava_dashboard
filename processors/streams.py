import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import ActivitySecond

def map_streams_to_db_model(activity_id, streams):
    time_stream = streams["time"]["data"]
    distance_stream = streams["distance"]["data"]
    speed_stream = streams.get("velocity_smooth", {}).get("data", [])
    hr_stream = streams.get("heartrate", {}).get("data", [])
    alt_stream = streams.get("altitude", {}).get("data", [])
    
    streams_list = []
    prev_distance = None
    
    for i in range(len(time_stream)):
        total_distance = distance_stream[i]
        
        if prev_distance is None:
            delta_distance = 0.0
        else:
            delta_distance = total_distance - prev_distance
            
        prev_distance = total_distance
        
        speed = speed_stream[i] if (speed_stream and i < len(speed_stream)) else None
        
        streams_list.append(ActivitySecond(
            activity_id=activity_id,
            second_index=time_stream[i],
            distance_total_m=total_distance,
            distance_delta_m=max(delta_distance, 0),
            speed_m_s=speed,
            heart_rate=hr_stream[i] if i < len(hr_stream) else None,
            elevation_m=alt_stream[i] if i < len(alt_stream) else None,
            pace_sec_km=(1000 / speed) if (speed and speed > 0) else None
        ))
        
    return streams_list