import re

from constants import (
    WORKOUT_EASY_OR_LONG,
    WORKOUT_INTERVAL,
    WORKOUT_HILL_REPEATS
)

def classify_workout(activity):
    description = activity.get("description", "")
    description = description.lower() if description else ""
    
    # hill repeats identifier
    hill_keywords = ["hill", "subida", "elevação"]
    if any(k in description for k in hill_keywords):
        return WORKOUT_HILL_REPEATS
    
    # interval sessions identifiers
    interval_keywords = ["tiro", "interval", "split"]
    if any(k in description for k in interval_keywords):
        return WORKOUT_INTERVAL
    
    # search for: 10x400, 5 x 1000, 8X1km
    series_pattern = r'\d+\s*[xX*]\s*\d+'
    if re.search(series_pattern, description):
        return WORKOUT_INTERVAL
    
    # search for: 5x3', 10 x 1:30
    time_pattern = r'\d+\s*[xX]\s*\d+[:\']'
    if re.search(time_pattern, description):
        return WORKOUT_INTERVAL
    
    return WORKOUT_EASY_OR_LONG
    
    