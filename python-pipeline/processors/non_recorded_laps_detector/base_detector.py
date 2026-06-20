from abc import ABC, abstractmethod

class BaseDetector(ABC):
    def __init__(self, min_speed_moving=0.3, cooldown_speed_threshold=2.2):
        self.min_speed_moving = min_speed_moving
        self.cooldown_speed_threshold = cooldown_speed_threshold
        
    @abstractmethod
    def _detect_blocks(self, processed_dict):
        pass
    
    @abstractmethod
    def _summarize_effort(self, block, label):
        pass
    
    def _summarize_common(self, data_dict_or_list, type_label):
        if isinstance(data_dict_or_list, list):
            data_dict = {t: d for t, d in data_dict_or_list}
        else:
            data_dict = data_dict_or_list
            
        times = sorted(data_dict.keys())
        if not times:
            return {}
        
        start_time = times[0]
        end_time = times[-1]
        start_data = data_dict[start_time]
        end_data = data_dict[end_time]
        
        distance = end_data["distance_total_m"] - start_data["distance_total_m"]
        moving_seconds = [t for t, d in data_dict.items() if d.get("speed_m_s", 0) > self.min_speed_moving]
        moving_duration = len(moving_seconds)
        
        avg_speed = distance / moving_duration if moving_duration > 0 else 0
        pace_seconds = 1000 / avg_speed if avg_speed > 0.3 else 0
        
        hr_values = [d.get("heart_rate", 0) for d in data_dict.values() if d.get("heart_rate")]
        avg_hr = sum(hr_values) / len(hr_values) if hr_values else 0
        
        return {
            "type": type_label,
            "lap_index": None,
            "start_sec": start_time,
            "end_sec": end_time,
            "total_duration_sec": int(end_time - start_time),
            "moving_duration_sec": int(moving_duration),
            "distance_m": round(distance, 1),
            "avg_pace": pace_seconds,
            "avg_hr": round(avg_hr, 1),
            "elev_gain_m": 0.0,
            "avg_grade_percent": 0.0,
            "vam": 0.0
        }
        
    # used to divide warmup and cooldown in 1km blocks
    def _split_into_km(self, data_dict, label_prefix):
        times = sorted(data_dict.keys())
        if not times: return []
        
        splits = []
        current_split_data = {}
        start_distance_offset = data_dict[times[0]]["distance_total_m"]
        split_count = 1
        
        for t in times:
            current_split_data[t] = data_dict[t]
            relative_distance = data_dict[t]["distance_total_m"] - start_distance_offset
            
            if relative_distance >= 1000:
                summary = self._summarize_common(current_split_data, label_prefix)
                summary["lap_index"] = split_count
                splits.append(summary)
                current_split_data = {}
                start_distance_offset = data_dict[t]["distance_total_m"]
                split_count += 1
            
        if current_split_data:
            summary = self._summarize_common(current_split_data, label_prefix)
            summary["lap_index"] = split_count
            splits.append(summary)
                        
        return splits
    
    def analyze(self, processed_dict):
        # detection
        effort_blocks = self._detect_blocks(processed_dict)
        
        if not effort_blocks:
            return self._split_into_km(processed_dict, "ACTIVITY")
        
        full_laps = []
        times = sorted(processed_dict.keys())
        
        # WARMUP
        warmup_end_time = effort_blocks[0][0][0]
        if warmup_end_time > times[0]:
            warmup_data = {t: processed_dict[t] for t in times if t < warmup_end_time}
            full_laps.extend(self._split_into_km(warmup_data, "WARMUP"))
            
        # SPLITS and RESTS
        rest_durations = []
        rest_distances = []
        for i, current_block in enumerate(effort_blocks):
            summary = self._summarize_effort(current_block, "WORKOUT")
            summary["lap_index"] = i + 1
            full_laps.append(summary)
            
            # rest between laps
            if i < len(effort_blocks) - 1:
                rest_start = current_block[-1][0] + 1
                rest_end = effort_blocks[i+1][0][0]
                rest_data = {t: processed_dict[t] for t in times if rest_start <= t <= rest_end}
                if rest_data:
                    lap = self._summarize_common(rest_data, "REST")
                    lap["lap_index"] = i + 1
                    full_laps.append(lap)
                    rest_durations.append(rest_end - rest_start)
                    rest_distances.append(lap["distance_m"])
                    
        avg_rest_time = sum(rest_durations) / len(rest_durations) if rest_durations else 60
        avg_rest_dist = sum(rest_distances) / len(rest_distances) if rest_distances else 0
        
        last_end = effort_blocks[-1][-1][0]
        cooldown_start = self._find_cooldown_start(processed_dict, last_end, times[-1], avg_rest_time, avg_rest_dist)
        
        # add last rest
        if cooldown_start > last_end + 1:
            rest_final = {t: processed_dict[t] for t in times if last_end < t < cooldown_start}
            lap = self._summarize_common(rest_final, "REST")
            lap["lap_index"] = len(effort_blocks)
            full_laps.append(lap)
        
        # COOLDOWN
        if cooldown_start < times[-1]:
            cooldown_data = {t: processed_dict[t] for t in times if t >= cooldown_start}
            full_laps.extend(self._split_into_km(cooldown_data, "COOLDOWN"))

        return full_laps
    
    def _find_cooldown_start(self, processed_dict, last_end, activity_end, avg_rest_time, avg_rest_dist):
        start_dist = processed_dict[last_end]["distance_total_m"]
        cooldown_time = last_end + 1
        for t in range(last_end + 1, activity_end + 1):
            if t not in processed_dict: continue
            data = processed_dict[t]
            rest_duration = t - last_end
            rest_dist = data["distance_total_m"] - start_dist
            
            if (avg_rest_dist > 0 and rest_dist > (avg_rest_dist * 1.1)) or (rest_duration > avg_rest_time and data.get("speed_m_s", 0) >= self.cooldown_speed_threshold):
                break
            cooldown_time = t + 1
        return cooldown_time