import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from intervals_processor.interval_detector import IntervalDetector

class HillDetector(IntervalDetector):
    def __init__(
        self,
        min_elevation_gain=5.0,
        min_grade=3.0,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.min_elevation_gain = min_elevation_gain
        self.min_grade = min_grade
        
    def analyze_hills(self, processed_dict):
        effort_blocks = self._detect_hill_blocks(processed_dict)
        if not effort_blocks:
            return []

        full_laps = []
        times = sorted(processed_dict.keys())
        
        # WARMUP
        warmup_end_time = effort_blocks[0][0][0]
        if warmup_end_time > times[0]:
            warmup_data = {t: processed_dict[t] for t in times if t < warmup_end_time}
            full_laps.extend(self._split_into_km(warmup_data, "WARMUP"))
            
        # HILL REPEATS (INTERVAL AND REST)
        for i, current_hill in enumerate(effort_blocks):
            hill_lap = self._summarize_hill_block(current_hill, f"HILL_{i+1}")
            full_laps.append(hill_lap)
            
            if i < len(effort_blocks) - 1:
                next_hill_start = effort_blocks[i+1][0][0]
                desc_start = current_hill[-1][0] + 1
                desc_data = {t: processed_dict[t] for t in times if desc_start <= t < next_hill_start}
                if desc_data:
                    full_laps.append(self._summarize_lap(desc_data, f"DESC_REST_{i+1}"))
                    
        # COOLDOWN
        last_hill_end = effort_blocks[-1][-1][0]
        if last_hill_end < times[-1]:
            cooldown_data = {t: processed_dict[t] for t in times if t > last_hill_end}
            full_laps.extend(self._split_into_km(cooldown_data, "COOLDOWN"))
            
        return full_laps
    
    def _detect_hill_blocks(self, processed_dict):
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
                
        return blocks
                
    def _is_valid_hill(self, block):
        if not block:
            return False
        
        elevation_gain = block[-1][1]["elevation_m"] - block[0][1]["elevation_m"]
        
        distance = block[-1][1]["distance_total_m"] - block[0][1]["distance_total_m"]
        
        avg_grade = (elevation_gain / distance * 100) if distance > 0 else 0
        
        return elevation_gain >= self.min_elevation_gain and avg_grade >= self.min_grade
    
    def _summarize_hill_block(self, block, type_label):
        summary = super()._summarize_block(block, type_label)
        
        start_data = block[0][1]
        end_data = block[-1][1]
        
        elevation_gain = end_data["elevation_m"] - start_data["elevation_m"]
        distance = summary["distance_m"]
        
        # inclination grade
        grade = (elevation_gain / distance) * 100 if distance > 0 else 0
        
        # average ascent speed
        moving_time = summary["moving_duration_sec"]
        vam = (elevation_gain / moving_time) * 3600 if moving_time > 0 else 0
        
        summary.update({
            "type": type_label,
            "elev_gain_m": round(elevation_gain, 1),
            "avg_grade_percent": round(grade, 1),
            "vam": round(vam),
            "start_elev": round(start_data["elevation"], 1), 
            "end_elev": round(end_data["elevation_m"], 1)
        })
        
        return summary