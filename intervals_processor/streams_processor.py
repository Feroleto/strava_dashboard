import pandas as pd
import numpy as np
from typing import Dict, List

def process_activity_streams_pd(seconds: List[object]) -> Dict[int, dict]:
    if not seconds:
        return {}
    
    # create DataFrame from objects
    df = pd.DataFrame([s.__dict__ for s in seconds])
    df = df.drop(columns=["_sa_instance_state"], errors="ignore")
    
    df = df.set_index("second_index")
    full_range = range(df.index.min(), df.index.max() + 1)
    df = df.reindex(full_range)
    
    df = df.apply(pd.to_numeric, errors="coerce")
    
    # interpolation
    df["distance_total_m"] = df["distance_total_m"].interpolate(method="linear", limit=20)
    df["elevation_m"] = df["elevation_m"].interpolate(method="linear", limit=10)
    df["heart_rate"] = df["heart_rate"].interpolate(method="linear", limit=15)
    
    df["speed_raw"] = df["distance_total_m"].diff().fillna(0)
    # speed central smoothing
    df["speed_m_s"] = df["speed_raw"].rolling(window=5, center=True, min_periods=1).mean()
    df["acceleration"] = df["speed_m_s"].diff().fillna(0)
    
    # hr ewm smoothing
    df["heart_rate"] = df["heart_rate"].ewm(alpha=0.2, adjust=False).mean()
    
    # hill repeats
    # smooth
    df["elevation_smooth"] = df["elevation_m"].rolling(window=7, center=True, min_periods=1).mean()
    df["elevation_delta"] = df["elevation_smooth"].diff().fillna(0)
    
    # elev grade
    df["grade_percent"] = (df["elevation_delta"] / df["distance_delta_m"]).replace(0, np.nan) * 100
    df["grade_percent"] = df["grade_percent"].clip(-40, 40).fillna(0)
    
    # vertical speed
    df["vertical_speed_m_s"] = df["elevation_delta"].rolling(window=5, center=True).mean().fillna(0)
    
    # security fill
    df["speed_m_s"] = df["speed_m_s"].fillna(0.0)
    df["distance_total_m"] = df["distance_total_m"].ffill()
    df["distance_delta_m"] = df["distance_total_m"].diff().fillna(0)
    
    # optimized pace
    df["pace_sec_km"] = np.where(df["speed_m_s"] > 0.3, 1000 / df["speed_m_s"], None)
    
    df[["elevation_m", "heart_rate", "vertical_speed_m_s"]] = df[["elevation_m", "heart_rate", "vertical_speed_m_s"]].fillna(0)
    
    return df.to_dict(orient="index")