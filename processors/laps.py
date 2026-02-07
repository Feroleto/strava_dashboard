import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import ActivityLap

def map_laps_to_db(activity_id, laps):
    laps_obj = []
    for lap in laps:
        laps_obj.append(ActivityLap(
            activity_id=activity_id,
            lap_type=lap["tyep"],
            lap_index=lap["lap_index"],
            start_sec=lap["start_sec"],
            end_sec=lap["end_sec"],
            distance_m=lap["distance_m"],
            total_duration_sec=lap["total_duration_sec"],
            moving_duration_sec=lap["moving_duration_sec"],
            avg_pace_sec_km=lap["avg_pace"],
            avg_hr=lap["avg_hr"],
            elev_gain_m=lap["elev_gain_m"],
            avg_grade_percent=lap["avg_grade_percent"],
            vam=lap["vam"]
        ))
    return laps_obj
