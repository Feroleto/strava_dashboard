from collections import deque
from typing import Dict, List, Optional

MAX_INTERPOLATION_GAP = 10
HR_EWMA_ALPHA = 0.2
SPEED_SMOOTH_WINDOW = 5

# convert ActivitySecond list to a dict indexed based on seconds
def normalize_by_time(seconds) -> Dict[int, object]:
    return {s.second_index: s for s in seconds}

def interpolate_series(
    time_map: Dict[int, object],
    attr: str,
    full_streams: List[int],
    max_gap: int = MAX_INTERPOLATION_GAP
) -> Dict[int, Optional[float]]:
    
    result = {}
    known_times = sorted(time_map.keys())
    
    for t in full_streams:
        # if the streams exists and is not null
        value = getattr(time_map.get(t), attr, None)
        if value is not None:
            result[t] = value
            continue
        
        # if doesn't exist search for the previous neighbor
        prev_t = next((kt for kt in reversed(known_times) if kt < t), None)
        next_t = next((kt for kt in known_times if kt > t), None)
        
        if prev_t is None or next_t is None:
            result[t] = None
            continue
        
        # verifying gap
        gap = next_t - prev_t
        if gap > max_gap:
            result[t] = None
            continue
        
        v0 = getattr(time_map[prev_t], attr)
        v1 = getattr(time_map[next_t], attr)
        
        interpolated_val = v0 + (v1 - v0) * ((t - prev_t) / (next_t - prev_t))
        result[t] = interpolated_val
        
    return result

def smooth_hr_ewma(
    series: Dict[int, Optional[float]],
    alpha: float = HR_EWMA_ALPHA
) -> Dict[int, Optional[float]]:
    smoothed = {}
    prev = None
    for t in sorted(series.keys()):
        v = series[t]
        
        if v is None:
            smoothed[t] = prev
        elif prev is None:
            prev = v
            smoothed[t] = v
        else:
            prev = alpha * v + (1 - alpha) * prev
            smoothed[t] = prev
            
    return smoothed

def smooth_moving_average(
    series: Dict[int, Optional[float]],
    window: int = SPEED_SMOOTH_WINDOW
) -> Dict[int, Optional[float]]:
    q = deque()
    smoothed = {}
    
    for t in sorted(series.keys()):
        q.append(series[t])
        if len(q) > window:
            q.popleft()
            
        valid = [x for x in q if x is not None]
        smoothed[t] = sum(valid) / len(valid) if valid else None
        
    return smoothed

def compute_pace_from_speed(speed: Optional[float]) -> Optional[float]:
    if speed and speed > 0.3:
        return 1000 / speed
    return None

def process_activity_seconds(seconds: List[object]) -> Dict[int, dict]:
    if not seconds:
        return {}
    
    time_map = normalize_by_time(seconds)
    start_time = min(time_map.keys())
    end_time = max(time_map.keys())
    full_seconds = list(range(start_time, end_time + 1))
    
    # interpolation
    hr_interp = interpolate_series(time_map, "heart_rate", full_seconds, max_gap=10)
    alt_interp = interpolate_series(time_map, "elevation_m", full_seconds, max_gap=10)
    dist_interp = interpolate_series(time_map, "distance_total_m", full_seconds, max_gap=20)
    
    speed_interp = interpolate_series(time_map, "speed_m_s", full_seconds, max_gap=5)
    
    # smoothing
    hr_smooth = smooth_hr_ewma(hr_interp)
    speed_smooth = smooth_moving_average(speed_interp)
    
    result = {}
    last_dist = 0.0
    
    for t in full_seconds:
        current_dist = dist_interp.get(t) or last_dist
        delta_m = current_dist - last_dist if t > start_time else 0.0
        
        speed = speed_smooth.get(t) or delta_m
        
        result[t] = {
            "speed_m_s": speed,
            "pace_sec_km": compute_pace_from_speed(speed),
            "heart_rate": hr_smooth.get(t) or 0.0,
            "elevation_m": alt_interp.get(t) or 0.0,
            "distance_total_m": current_dist,
            "distance_delta_m": max(delta_m, 0)
        }
        last_dist = current_dist
        
    return result
