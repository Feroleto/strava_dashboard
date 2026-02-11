import numpy as np

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from processors.type_classifiers.util_type_classifiers import (
    HILL_WORKOUT_SCORE,
    HILL_REST_SCORE,
    
    WORKOUT_LABEL,
    REST_LABEL,
    STEADY_LABEL,
    WARMUP_LABEL,
    COOLDOWN_LABEL
)

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