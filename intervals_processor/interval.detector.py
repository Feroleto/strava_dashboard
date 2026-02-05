MIN_SPEED = 3.3
MAX_BREAK_ALLOWED = 15
MIN_BLOCK_DIST = 150

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
                    
                    if self._is_valid_block(real_block):
                        blocks.append(self._summarize_block(real_block))
                        
                    current_block = []
                    gap_counter = 0
        
        if current_block:
            real_block = current_block[:-gap_counter] if gap_counter > 0 else current_block
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