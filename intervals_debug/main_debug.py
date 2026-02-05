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

def main():
    choice = input("Choose between laps/streams: ")
    
    if choice == "laps":
        full_data = get_activity_by_id(ACTIVITY_ID)
        laps = extract_laps_from_activities(full_data)
        if len(laps) == 1:
            streams = get_streams(ACTIVITY_ID)
            processed_streams = process_activity_streams_pd(streams)
            detector = IntervalDetector(min_speed=MIN_SPEED, min_block_dist=MIN_BLOCK_DIST)
            intervals = detector.detect_intervals(processed_streams)
            show_autodetected_laps(intervals)
        else:
            laps = filter_speed_laps(laps)
            show_recorded_laps(laps)
        

    else:
        streams = get_streams()
        processed_streams = process_activity_streams_pd(streams)
        show_streams(processed_streams)
        
if __name__ == "__main__":
    main()