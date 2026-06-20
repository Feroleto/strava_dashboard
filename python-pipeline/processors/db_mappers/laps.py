import numpy as np

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import ActivityLap
from processors.type_classifiers.interval_laps_type_classifier import classify_interval_laps_type
from processors.type_classifiers.hill_laps_type_classifier import classify_hill_laps_type
from type_classifiers.util_type_classifiers import WORKOUT_INTERVAL, WORKOUT_HILL_REPEATS

def map_laps_to_db_model(activity_id, laps, workout_type=None):
    laps_obj = []
    
    if laps and laps[0]["type"] == "Lap 1":
        if workout_type == WORKOUT_INTERVAL:
            types = classify_interval_laps_type(laps)
        elif workout_type == WORKOUT_HILL_REPEATS:
            types = classify_hill_laps_type(laps)
    else:
        types = [l.get("type", "RUN") for l in laps]
        
    for i, (lap, lap_type) in enumerate(zip(laps, types)):
        laps_obj.append(ActivityLap(
            activity_id=activity_id,
            lap_type=lap_type,
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
