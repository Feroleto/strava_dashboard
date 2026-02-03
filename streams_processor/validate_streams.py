import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.config import SessionLocal
from database.models import ActivitySecond
from streams_processor.processing_streams import process_activity_seconds
from analysis.formatters import format_seconds

ACTIVITY_ID = 16888423217

def validate_processed_streams(processed_dict):
    if processed_dict:
        print(f"Total of seconds recorded: {len(processed_dict)}")
        
        sorted_seconds = sorted(processed_dict.keys())
        
        print("\nFirst 30 seconds data: ")
        print(f"{'Sec':<6} | {'Dist_Total':<12} | {'Delta':<8} | {'Pace':<8} | {'HR':<5} | {'Elev':<6}")
        print("-"*70)
        
        #for t in sorted_seconds:
        for t in sorted_seconds[:30]:
            data = processed_dict[t]
            pace_raw = data.get("pace_sec_km")
            pace_str = format_seconds(pace_raw) if pace_raw else "0:00"
            
            dist_total = data.get("distance_total_m", 0)
            dist_delta = data.get("distance_delta_m", 0)
            hr = data.get("heart_rate")
            elev = data.get("elevation_m")
            
            print(f"{t:>4}s   | "
                  f"{dist_total:>10.1f}m | "
                  f"{dist_delta:>6.2f}m | "
                  f"{pace_str:<8} | "
                  f"{int(hr) if hr else 'N/A':>5} | "
                  f"{elev:>6.1f}m")
                 
    else:
        print("No processed streams found")


def main():
    session = SessionLocal()

    seconds = (
        session.query(ActivitySecond)
        .filter_by(activity_id=ACTIVITY_ID)
        .order_by(ActivitySecond.second_index)
        .all()
    )

    processed_activity = process_activity_seconds(seconds)
    validate_processed_streams(processed_activity)
    
if __name__ == "__main__":
    main()