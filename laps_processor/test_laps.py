import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.formatters import format_seconds
from collector.activities import get_activity_by_id
from laps_processor.laps_extractor import filter_speed_laps, extract_laps_from_activities


#ACTIVITY_ID = 16888423217 # 10x400
#ACTIVITY_ID = 16962023462 # 5x200 + 4x400 + 2x800
#ACTIVITY_ID = 16848750867 # 5x400 + 1x1km
#ACTIVITY_ID = 16819680946 # 10x200 + 5x400
#ACTIVITY_ID = 14392947474 # recorded on strava -> don't find intervals
#ACTIVITY_ID = 16527840409 # 6 x (200 + 400)
ACTIVITY_ID = 16279513590 # strava recorded activity -> find intervals

def test_activity_laps(full_data):
    laps = extract_laps_from_activities(full_data)
    #laps = full_data.get("laps", [])
    
    laps = filter_speed_laps(laps)
    
    if not laps:
        print("Laps weren't found for this activity")
        return
    
    print(f"\n" + "="*90)
    print(f"🏁 LAPS FOUND: {full_data.get('name')}")
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
        #print(f"{start_index:<8} | {end_index:<8} | {time_str:<8} | {meters:>8.1f}m | {pace_str}")
        
    print("="*90)
    
def main():
    full_data = get_activity_by_id(ACTIVITY_ID)
    test_activity_laps(full_data)
    
if __name__ == "__main__":
    main()