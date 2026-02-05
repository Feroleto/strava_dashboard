import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from analysis.formatters import format_seconds

SECONDS_TO_SHOW = 100

def show_streams(processed_dict):
    if processed_dict:
        print(f"Total of seconds recorded: {len(processed_dict)}")
        
    sorted_seconds = sorted(processed_dict.keys())
    
    print(f"\nFirst {SECONDS_TO_SHOW} seconds data: ")
    print(f"{'Sec':<6} | {'Dist_Total':<12} | {'Delta':<8} | {'Pace':<8} | {'HR':<5} | {'Elev':<6}")
    print("-"*70)
    
    for t in sorted_seconds[:SECONDS_TO_SHOW]:
        data = processed_dict[t]
        pace_raw = data.get("pace_sec_km")
        pace_str = format_seconds(pace_raw) if pace_raw else "0:00"
            
        dist_total = data.get("distance_total_m", 0)
        dist_delta = data.get("distance_delta_m", 0)
        hr = data.get("heart_rate")
        elev = data.get("elevation_m") if data["elevation_m"] else 0
            
        print(f"{t:>4}s   | "
              f"{dist_total:>10.1f}m | "
              f"{dist_delta:>6.2f}m | "
              f"{pace_str:<8} | "
              f"{int(hr) if hr else 'N/A':>5} | "
              f"{elev:>6.1f}m")