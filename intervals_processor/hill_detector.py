import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from intervals_processor.interval_detector import IntervalDetector

class HillDetector(IntervalDetector):
    def __init__(
        self,
        min_elevation_gain=5.0,
        min_grade=3.0,
        min_warmup_dist_m=1000,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.min_elevation_gain = min_elevation_gain
        self.min_grade = min_grade
        self.min_warmup_dist_m = min_warmup_dist_m
        
    def analyze_hills(self, processed_dict):
        # detect all potencial blocks
        raw_blocks = self._detect_hill_blocks(processed_dict)
        
        # filter blocks that started before the warmup distance
        effort_blocks = []
        for block in raw_blocks:
            start_distance = block[0][1].get("distance_total_m", 0)
            if start_distance >= self.min_warmup_dist_m:
                effort_blocks.append(block)
        
        if not effort_blocks:
            times = sorted(processed_dict.keys())
            return self._split_into_km(processed_dict, "ACTIVITY")

        full_laps = []
        times = sorted(processed_dict.keys())
        last_sec = times[-1]
        
        # WARMUP
        warmup_end_time = effort_blocks[0][0][0]
        if warmup_end_time > times[0]:
            warmup_data = {t: processed_dict[t] for t in times if t < warmup_end_time}
            full_laps.extend(self._split_into_km(warmup_data, "WARMUP"))
            
        # HILL REPEATS (INTERVAL AND REST)
        rest_durations = []
        for i, current_hill in enumerate(effort_blocks):
            hill_lap = self._summarize_hill_block(current_hill, f"HILL_{i+1}")
            full_laps.append(hill_lap)
            
            if i < len(effort_blocks) - 1:
                next_hill_start = effort_blocks[i+1][0][0]
                rest_start = current_hill[-1][0] + 1
                rest_data = {t: processed_dict[t] for t in times if rest_start <= t < next_hill_start}
                if rest_data:
                    rest_duration = next_hill_start - rest_start
                    rest_durations.append(rest_duration)
                    full_laps.append(self._summarize_lap(rest_data, f"DESC_REST_{i+1}"))
                    
        # last activity rest
        last_hill_end = effort_blocks[-1][-1][0]
        avg_rest_time = sum(rest_durations) / len(rest_durations) if rest_durations else 60
        
        prev_rest_distances = [l["distance_m"] for l in full_laps if "DESC_REST" in l["type"]]
        avg_rest_distance = sum(prev_rest_distances) / len(prev_rest_distances) if prev_rest_distances else 0
        
        rest_final_data = {}
        cooldown_start_time = last_hill_end + 1
        
        for t in range(last_hill_end + 1, last_sec + 1):
            if not t in processed_dict:
                continue
            
            data = processed_dict[t]
            speed = data.get("speed_m_s", 0)
            duration_last_rest = t - last_hill_end
            
            is_within_time = duration_last_rest <= avg_rest_time
            is_slow = speed < 2.2
            
            if is_within_time or is_slow:
                rest_final_data[t] = data
                cooldown_start_time = t + 1
            else:
                break
        
        print(avg_rest_distance)
            
        # distance last check
        if avg_rest_distance > 0 and rest_final_data:
            start_distance = processed_dict[last_hill_end]["distance_total_m"]
            times_in_rest = sorted(rest_final_data.keys())
            
            for t in times_in_rest:
                current_distance = rest_final_data[t]["distance_total_m"] - start_distance
                
                if current_distance > (avg_rest_distance * 1.1):
                    rest_final_data = {sec: val for sec, val in rest_final_data.items() if sec <= t}
                    cooldown_start_time = t + 1
                    break
                
        if rest_final_data:
            full_laps.append(self._summarize_lap(rest_final_data, f"REST_{len(effort_blocks)}"))

        # COOLDOWN
        if cooldown_start_time <= last_sec:
            cooldown_data = {t: processed_dict[t] for t in times if t >= cooldown_start_time}
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
            "start_elev": round(start_data["elevation_m"], 1), 
            "end_elev": round(end_data["elevation_m"], 1)
        })
        
        return summary