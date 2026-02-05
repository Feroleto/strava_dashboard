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
        
        
    def analyze_full_activity(self, processed_dict):
        effort_blocks = self._detect_effort_raw_blocks(processed_dict)
        if not effort_blocks:
            return []
        
        full_laps = []
        times = sorted(processed_dict.keys())
        first_sec = times[0]
        last_sec = times[-1]
        
        # WARMUP
        warmup_end_time = effort_blocks[0][0][0]
        if warmup_end_time > first_sec:
            warmup_data = {t: processed_dict[t] for t in times if t < warmup_end_time}
            full_laps.extend(self._split_into_km(warmup_data, "WARMUP"))
            
            
        # INTERVALS and REST
        rest_durations = []
        for i, current_effort in enumerate(effort_blocks):
            effort_lap = self._summarize_block(current_effort, f"WORKOUT_{i+1}")
            full_laps.append(effort_lap)
            
            # if it's not the last interval, process the rest time
            if i < len(effort_blocks) - 1:
                next_effort_start = effort_blocks[i+1][0][0]
                rest_start = current_effort[-1][0] + 1
                
                rest_data = {t: processed_dict[t] for t in times if rest_start <= t < next_effort_start}
                if rest_data:
                    rest_duration = next_effort_start - rest_start
                    rest_durations.append(rest_duration)
                    full_laps.append(self._summarize_lap(rest_data, f"REST_{i+1}"))
        
        # last rest using average rest time
        last_effort_end = effort_blocks[-1][-1][0]
        avg_rest_time = sum(rest_durations) / len(rest_durations) if rest_durations else 60
        
        rest_final_data = {}
        cooldown_start_time = last_effort_end + 1
        
        for t in range(last_effort_end + 1, last_sec + 1):
            if t not in processed_dict:
                continue
            
            data = processed_dict[t]
            speed = data.get("speed_m_s", 0)
            duration_last_rest = t - last_effort_end
            
            # still walking or on rest time range
            if speed < 2.2 or duration_last_rest <= avg_rest_time:
                rest_final_data[t] = data
                cooldown_start_time = t + 1
            else:
                break
        
        if rest_final_data:
            full_laps.append(self._summarize_lap(rest_final_data, f"REST_{len(effort_blocks)}"))
        
        # COOLDOWN
        if cooldown_start_time <= last_sec:
            cooldown_data = {t: processed_dict[t] for t in times if t >= cooldown_start_time}
            full_laps.extend(self._split_into_km(cooldown_data, "COOLDOWN"))
        
        return full_laps
    
    def _detect_effort_raw_blocks(self, processed_dict):
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
    
    # divide seconds dict in 1km laps
    def _split_into_km(self, data_dict, label_prefix):
        times = sorted(data_dict.keys())
        splits = []
        current_split_data = {}
        
        start_distance_offset = data_dict[times[0]]["distance_total_m"]
        split_count = 1
        
        for t in times:
            current_split_data[t] = data_dict[t]
            relative_distance = data_dict[t]["distance_total_m"] - start_distance_offset
            
            if relative_distance >= 1000:
                splits.append(self._summarize_lap(current_split_data, f"{label_prefix}_KM_{split_count}"))
                current_split_data = {}
                start_distance_offset = data_dict[t]["distance_total_m"]
                split_count += 1
            
        if current_split_data:
            splits.append(self._summarize_lap(current_split_data, f"{label_prefix}_KM_{split_count}"))
            
        return splits
    
    def _summarize_lap(self, data_dict, type_label):
        times = sorted(data_dict.keys())
        
        # filtering idle time
        moving_seconds = [t for t, data in data_dict.items() if data.get("speed_m_s", 0) > 0.3]
        moving_duration = len(moving_seconds)
        total_duration = times[-1] - times[0] if times else 0
        
        start_time = times[0]
        end_time = times[-1]
        distance = data_dict[end_time]["distance_total_m"] - data_dict[start_time]["distance_total_m"]
        #duration = end_time - start_time
        avg_speed = distance / moving_duration if moving_duration > 0 else 0
        pace_seconds = 1000 / avg_speed if avg_speed > 0.3 else 0
        
        return {
            "type": type_label,
            "start_sec": start_time,
            "total_duration_sec": total_duration,
            "moving_duration_sec": moving_duration,
            "distance_m": round(distance, 1),
            "avg_pace": pace_seconds,
            "avg_hr": sum(d.get("heart_rate", 0) for d in data_dict.values()) / len(data_dict)
        }
    
    
    def _summarize_block(self, block, type_label):
        start_time = block[0][0]
        end_time = block[-1][0]
        
        moving_seconds = [d for d in block if d[1].get("speed_m_s", 0) > 0.3]
        moving_duration = len(moving_seconds)
        
        end_data = block[-1][1]
        start_data = block[0][1]
        distance = end_data["distance_total_m"] - start_data["distance_total_m"]
        
        avg_speed = distance / moving_duration if moving_duration > 0 else 0
        pace_seconds = 1000 / avg_speed if avg_speed > 0 else 0
        
        return {
            "type": type_label,
            "start_sec": start_time,
            "end_sec": end_time,
            "total_duration_sec": end_time - start_time,
            "moving_duration_sec": moving_duration,
            "distance_m": round(distance, 1),
            "avg_pace": pace_seconds,
            "avg_hr": sum((d[1].get("heart_rate") or 0.0) for d in block) / len(block)
        }