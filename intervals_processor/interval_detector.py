import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from intervals_processor.base_detector import BaseDetector

class IntervalDetector(BaseDetector):
    def __init__(self, min_speed=3.3, max_break_allowed=10, min_block_dist=150, **kwargs):
        super().__init__(**kwargs)
        self.min_speed = min_speed
        self.max_break_allowed = max_break_allowed
        self.min_block_dist = min_block_dist
    
    
    def _detect_blocks(self, processed_dict):
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
                    if gap_counter >= len(current_block):
                        real_block = []
                    else:
                        real_block = current_block[:-gap_counter] if gap_counter > 0 else current_block
                    
                    if real_block and self._is_valid_block(real_block):
                        blocks.append(real_block)
                        
                    current_block = []
                    gap_counter = 0
                    
        if current_block:
            real_block = current_block[:-gap_counter] if gap_counter > 0 else current_block
            if self._is_valid_block(real_block):
                blocks.append(real_block)
                
        return blocks
    
    def _is_valid_block(self, block):
        if not block:
            return False
        
        dist = block[-1][1]["distance_total_m"] - block[0][1]["distance_total_m"]
        return dist >= self.min_block_dist
    
    def _summarize_effort(self, block, label):
        summary = self._summarize_common(block, label)
        
        elev_gain = block[-1][1]["elevation_m"] - block[0][1]["elevation_m"]
        
        summary.update({
            "elev_gain_m": round(elev_gain, 1),
            "avg_grade_percent": 0.0,
            "vam": 0.0
        })
        
        return summary