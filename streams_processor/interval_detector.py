import math

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import SessionLocal
from database.models import ActivitySecond
from streams_processor.processing_streams import process_activity_seconds

MIN_SPEED = 3.4
MAX_BREAK_ALLOWED = 5
MIN_BLOCK_DIST = 150

ACTIVITY_ID = 16888423217 # 10x400
#ACTIVITY_ID = 16962023462 # 5x200 + 4x400 + 2x800
#ACTIVITY_ID = 16848750867 # 5x400 + 1x1km
#ACTIVITY_ID = 16819680946 # 10x200 + 5x400
#ACTIVITY_ID = 14392947474 # recorded on strava -> don't find intervals
#ACTIVITY_ID = 16527840409 # testing
#ACTIVITY_ID = 16279513590 # strava recorded activity -> find intervals

class IntervalDetector:
    def __init__(
        self, 
        min_speed=MIN_SPEED, 
        max_break_allowed=MAX_BREAK_ALLOWED, 
        min_block_dist=MIN_BLOCK_DIST
):
        self.min_speed = min_speed
        self.max_break_allowed = max_break_allowed
        self.min_block_dist = min_block_dist
        
    def detect_intervals(self, processed_dict):
        times = sorted(processed_dict.keys())
        blocks = []
        current_block = []
        gap_counter = 0
        
        for t in times:
            data = processed_dict[t]
            speed = data.get("speed_m_s") or 0.0
            
            if speed >= self.min_speed:
                current_block.append((t, data))
                gap_counter = 0
            else:
                if current_block and gap_counter < self.max_break_allowed:
                    current_block.append((t, data))
                    gap_counter += 1
                elif current_block:
                    real_block = current_block[:-gap_counter] if gap_counter > 0 else current_block
                    #real_block = current_block
                    
                    if self._is_valid_block(real_block):
                        blocks.append(self._summarize_block(real_block))
                        
                    current_block = []
                    gap_counter = 0
        
        if current_block:
            real_block = current_block[:-gap_counter] if gap_counter > 0 else current_block
            #real_block = current_block
            if self._is_valid_block(real_block):
                blocks.append(self._summarize_block(real_block))
                
        return blocks
                    
    def _is_valid_block(self, block):
        if not block:
            return False
        
        dist = block[-1][1]["distance_total_m"] - block[0][1]["distance_total_m"]
        return dist >= self.min_block_dist
    
    def _summarize_block(self, block):
        start_time, start_data = block[0]
        end_time, end_data = block[-1]
        
        duration = end_time - start_time
        distance = end_data["distance_total_m"] - start_data["distance_total_m"]
        
        avg_speed = distance / duration if duration > 0 else 0
        pace_seconds = 1000 / avg_speed if avg_speed > 0 else 0
        
        return {
            "start_sec": start_time,
            "end_sec": end_time,
            "duration_sec": duration,
            "distance_m": round(distance, 1),
            "avg_pace": pace_seconds,
            "avg_hr": sum((d[1].get("heart_rate") or 0.0) for d in block) / len(block)
        }
        
def format_pace(seconds):
    if not seconds or math.isinf(seconds): return "0:00"
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"

def run_interval_analysis(processed_activity):
    detector = IntervalDetector(min_speed=MIN_SPEED, min_block_dist=MIN_BLOCK_DIST)
    intervals = detector.detect_intervals(processed_activity)
    
    print(f"\n" + "="*80)
    print(f" DETECTED SPLITS ANALYSIS: {len(intervals)} splits")
    print("-" * 80)
    print(f"{'Split':<6} | {'Start':<7} | {'Time':<8} | {'Distance':<10} | {'Pace'}")
    print("-" * 80)
    
    for i, interval in enumerate(intervals, 1):
        print(f"{i:<6} | {interval['start_sec']:>5}s | {interval['duration_sec']:>6}s | "
              f"{interval['distance_m']:8.1f}m | {format_pace(interval['avg_pace'])}")
        
        #print("="*80)
        
def get_streams():
    session = SessionLocal()
    
    seconds = (
        session.query(ActivitySecond)
        .filter_by(activity_id=ACTIVITY_ID)
        .order_by(ActivitySecond.second_index)
        .all()
    )
    
    return seconds
        
def main():
    streams = get_streams()
    processed_streams = process_activity_seconds(streams)
    run_interval_analysis(processed_streams)
    
if __name__ == "__main__":
    main()