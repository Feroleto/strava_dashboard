import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from analysis.formatters import format_seconds

def show_recorded_laps(laps):
    if not laps:
        print("Laps weren't found for this activity")
        return
    
    print(f"\n" + "="*90)
    print(f"STRAVA/GARMIN recorded laps: {len(laps)}")
    print("-" * 90)
    print(f"{'Lap':<4} | {'Start':<8} | {'End':<8} | {'Time':<8} | {'Distance':<10} | {'Pace'}")
    print("-" * 90)
    
    for lap in laps:
        lap_index = lap.get("lap_index")
        start_index = lap.get("start_index")
        end_index = lap.get("end_index")
        
        seconds = lap.get("moving_time")
        meters = lap.get("distance")
        
        if meters > 0:
            avg_speed = meters / seconds
            pace_raw = 1000 / avg_speed
            pace_str = format_seconds(pace_raw)
        else:
            pace_str = "0:00"
            
        time_str = f"{seconds//60:02d}:{seconds%60:02d}"
        
        print(f"{lap_index:<4} | {start_index:<8} | {end_index:<8} | {time_str:<8} | {meters:>8.1f}m | {pace_str}")
        
    print("="*90)
    
def show_autodetected_laps(laps):
    if not laps:
        print("Laps weren't found for this activity")
        return
    
    print(f"\n" + "="*80)
    print(f" AUTO detected laps: {len(laps)}")
    print("-" * 80)
    print(f"{'Split':<6} | {'Start':<7} | {'Time':<8} | {'Distance':<10} | {'Pace'}")
    print("-" * 80)
    
    for i, lap in enumerate(laps, 1):
        print(f"{i:<6} | {lap['start_sec']:>5}s | {lap['moving_duration_sec']:>6}s | "
              f"{lap['distance_m']:8.1f}m | {format_seconds(lap['avg_pace'])}")
