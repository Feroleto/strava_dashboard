import numpy as np

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from processors.type_classifiers.util_type_classifiers import (
    INTERVAL_WORKOUT_SCORE,
    INTERVAL_REST_SCORE,
    
    WORKOUT_LABEL,
    REST_LABEL,
    STEADY_LABEL,
    WARMUP_LABEL,
    COOLDOWN_LABEL
)

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