import numpy as np

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import ActivityLap
from utils.constants import WORKOUT_INTERVAL, WORKOUT_HILL_REPEATS

WORKOUT_LABEL = "WORKOUT"
REST_LABEL = "REST"
STEADY_LABEL = "STEADY"
WARMUP_LABEL = "WARMUP"
COOLDOWN_LABEL = "COOLDOWN"

INTERVAL_WORKOUT_SCORE = 0.45
INTERVAL_REST_SCORE = -0.5

HILL_WORKOUT_SCORE = 0.5
HILL_REST_SCORE = -0.5

# classify laps based on speed standard deviation(sd)
def classify_interval_laps_type(laps_data: list):
    if len(laps_data) <= 1:
        return ["RUN"]
    
    # extract speed
    speeds = np.array([lap.get("avg_speed", 0) for lap in laps_data])
    mean_speed = np.mean(speeds)
    std_speed = np.std(speeds)
    
    # speed is continuos
    if std_speed < 0.1:
        return ["RUN"] * len(laps_data)
    
    initial_labels = []
    for speed in speeds:
        # calculate how far the lap is from the avg sd
        z_score = (speed - mean_speed) / std_speed
        if z_score > INTERVAL_WORKOUT_SCORE: # above average
            label = WORKOUT_LABEL
        elif z_score < INTERVAL_REST_SCORE: # below average
            label = REST_LABEL
        else: # on average, can be WARMUP or COOLDOWN
            label = STEADY_LABEL
        initial_labels.append(label)
    
    # mark the end of WARMUP
    first_workout_index = next((i for i, label in enumerate(initial_labels) if label == WORKOUT_LABEL), None)
    # mark the beggin of COOLDOWN
    last_workout_index = next((i for i in reversed(range(len(initial_labels))) if initial_labels[i] in [WORKOUT_LABEL, REST_LABEL]), None)
    
    # reajusting labels (WARMUP, COOLDOWN)
    final_results = []
    for i, label in enumerate(initial_labels):
        # WARMUP
        if first_workout_index is not None and i < first_workout_index:
            final_label = WARMUP_LABEL
        # COOLDOWN
        elif last_workout_index is not None and i > last_workout_index:
            final_label = COOLDOWN_LABEL
        
        else:
            if label == STEADY_LABEL:
                z_score = (speeds[i] - mean_speed) / std_speed
                if z_score > 0:
                    final_label = "RUN"
                else:
                    final_label = REST_LABEL
            else:
                final_label = label
        final_results.append(final_label)
        
    return final_results

def classify_hill_laps_type(laps_data: list):
    if len(laps_data) <= 1:
        return ["RUN"]
    
    # extract and calcule vam standard deviation
    vam_values = np.array([lap.get("vam", 0) for lap in laps_data])
    mean_vam = np.mean(vam_values)
    std_vam = np.std(vam_values)
    
    # if the elevation variation is minimal, it's not a hill training
    if std_vam < 50:
        return ["RUN"] * len(laps_data)
    
    initial_labels = []
    for vam in vam_values:
        z_score = (vam - mean_vam) / std_vam
        
        if z_score > HILL_WORKOUT_SCORE:
            label = WORKOUT_LABEL
        elif z_score < HILL_REST_SCORE:
            label = REST_LABEL
        else:
            label = STEADY_LABEL
        initial_labels.append(label)
    
    # mark the end of WARMUP
    first_workout_index = next((i for i, label in enumerate(initial_labels) if label == WORKOUT_LABEL), None)
    # mark the beggin of COOLDOWN
    last_workout_index = next((i for i in reversed(range(len(initial_labels))) if initial_labels[i] == WORKOUT_LABEL), None) + 1
        
    # reajusting labels (WARMUP, COOLDOWN)
    final_results = []
    for i, label in enumerate(initial_labels):
        # WARMUP
        if first_workout_index is not None and i < first_workout_index:
            final_label = WARMUP_LABEL
        # COOLDOWN
        elif last_workout_index is not None and i > last_workout_index:
            final_label = COOLDOWN_LABEL
        else:
            if label == STEADY_LABEL:
                z_score = (vam_values[i] - mean_vam) / std_vam
                if z_score > 0:
                    final_label = "RUN"
                else:
                    final_label = REST_LABEL
            else:
                final_label = label
        final_results.append(final_label)
    
    return final_results

def map_laps_to_db(activity_id, laps, workout_type=None):
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
