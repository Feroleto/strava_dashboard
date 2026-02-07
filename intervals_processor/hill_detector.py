import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from intervals_processor.base_detector import BaseDetector

class HillDetector(BaseDetector):
    def __init__(self, min_elevation_gain=5.0, min_grade=2.0, min_warmup_dist_m=1000, **kwargs):
        super().__init__(**kwargs)
        self.min_elevation_gain = min_elevation_gain
        self.min_grade = min_grade
        self.min_warmup_dist_m = min_warmup_dist_m
        
    def _detect_blocks(self, processed_dict):
        times = sorted(processed_dict.keys())
        blocks = []
        current_block = []
        
        gap_counter = 0
        max_gap = 5
        
        for t in times:
            data = processed_dict[t]
            grade = data.get("grade_percent", 0)
            vertical_speed = data.get("vertical_speed_m_s", 0)
            
            is_uphill = grade > 1.0 or vertical_speed > 0.05
            
            if is_uphill:
                current_block.append((t, data))
                gap_counter = 0
            else:
                if current_block and gap_counter < max_gap:
                    current_block.append((t, data))
                    gap_counter += 1
                elif current_block:
                    real_block = current_block[:-gap_counter] if gap_counter > 0 else current_block
                    if self._is_valid_hill(real_block):
                        blocks.append(real_block)
                    current_block = []
                    gap_counter = 0
                    
        if current_block:
            real_block = current_block[:-gap_counter] if gap_counter > 0 else current_block
            if self._is_valid_hill(real_block):
                blocks.append(real_block)
        
        # filter warmup distance
        return [b for b in blocks if b[0][1]["distance_total_m"] >= self.min_warmup_dist_m]
    
    def _is_valid_hill(self, block):
        if not block:
            return False
        
        elevation_gain = block[-1][1]["elevation_m"] - block[0][1]["elevation_m"]
        
        distance = block[-1][1]["distance_total_m"] - block[0][1]["distance_total_m"]
        
        avg_grade = (elevation_gain / distance * 100) if distance > 0 else 0
        
        return elevation_gain >= self.min_elevation_gain and avg_grade >= self.min_grade
    
    def _summarize_effort(self, block, label):
        summary = self._summarize_common(block, label)
        elev_gain = block[-1][1]["elevation_m"] - block[0][1]["elevation_m"]
        avg_grade_percent = elev_gain / summary["distance_m"] * 100 if summary["distance_m"] > 0 else 0
        vam = elev_gain / summary["moving_duration_sec"] * 3600 if summary["moving_duration_sec"] > 0 else 0
        
        summary.update({
            "type": label.replace("WORKOUT", "HILL_REPEATS"),
            "elev_gain_m": round(elev_gain, 1),
            "avg_grade_percent": round(avg_grade_percent, 1),
            "vam": round(vam)
        })
        return summary