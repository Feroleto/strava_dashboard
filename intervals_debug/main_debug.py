import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from collector.activities import get_activity_by_id

from intervals_debug.laps import show_recorded_laps, show_autodetected_laps
from intervals_debug.streams import show_streams
from intervals_debug.query_streams import get_streams
from intervals_debug.activities_consts import ACTIVITY_ID

from intervals_processor.streams_processor import process_activity_streams_pd
from intervals_processor.laps_extractor import extract_laps_from_activities, filter_speed_laps
from intervals_processor.interval_detector import IntervalDetector, MIN_SPEED, MIN_BLOCK_DIST
from intervals_processor.hill_detector import HillDetector

from processors.activity_classifier import classify_workout
from utils.constants import WORKOUT_INTERVAL, WORKOUT_HILL_REPEATS

def main():
    choice = input("Choose between laps/streams: ")
    
    if choice == "laps":
        full_data = get_activity_by_id(ACTIVITY_ID)
        laps = extract_laps_from_activities(full_data)
        
        if len(laps) != 1:
            streams = get_streams(ACTIVITY_ID)
            processed_streams = process_activity_streams_pd(streams)
            workout_type = classify_workout(full_data)
            if workout_type == WORKOUT_INTERVAL:
                interval_detector = IntervalDetector(min_speed=MIN_SPEED, min_block_dist=MIN_BLOCK_DIST)
                laps = interval_detector.analyze_full_activity(processed_streams)
            elif workout_type == WORKOUT_HILL_REPEATS:
                hill_detector = HillDetector(min_elevation_gain=5.0, min_grade=2.0)
                laps = hill_detector.analyze_hills(processed_streams)
            
            show_autodetected_laps(laps)
        else:
            show_recorded_laps(laps)
        
    else:
        streams = get_streams(ACTIVITY_ID)
        processed_streams = process_activity_streams_pd(streams)
        show_streams(processed_streams)
        
if __name__ == "__main__":
    main()