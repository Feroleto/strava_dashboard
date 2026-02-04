import pandas as pd
import numpy as np
from typing import Dict, List

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.config import SessionLocal
from database.models import ActivitySecond
from analysis.formatters import format_seconds

#ACTIVITY_ID = 16888423217
ACTIVITY_ID = 16527840409

SECONDS_TO_SHOW = 100

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
    
    # security fill
    df["speed_m_s"] = df["speed_m_s"].fillna(0.0)
    df["distance_total_m"] = df["distance_total_m"].ffill()
    df["distance_delta_m"] = df["distance_total_m"].diff().fillna(0)
    
    # optimized pace
    df["pace_sec_km"] = np.where(df["speed_m_s"] > 0.3, 1000 / df["speed_m_s"], None)
    
    df[["elevation_m", "heart_rate"]] = df[["elevation_m", "heart_rate"]].fillna(0)
    
    return df.to_dict(orient="index")

def validate_processed_streams(processed_dict):
    if processed_dict:
        print(f"Total of seconds recorded: {len(processed_dict)}")
        
        sorted_seconds = sorted(processed_dict.keys())
        
        print("\nFirst 30 seconds data: ")
        print(f"{'Sec':<6} | {'Dist_Total':<12} | {'Delta':<8} | {'Pace':<8} | {'HR':<5} | {'Elev':<6}")
        print("-"*70)
        
        #for t in sorted_seconds:
        for t in sorted_seconds[:SECONDS_TO_SHOW]:
            data = processed_dict[t]
            pace_raw = data.get("pace_sec_km")
            pace_str = format_seconds(pace_raw) if pace_raw else "0:00"
            
            dist_total = data.get("distance_total_m", 0)
            dist_delta = data.get("distance_delta_m", 0)
            hr = data.get("heart_rate")
            elev = data.get("elevation_m") if data["elevation_m"] else 0
            
            print(f"{t:>4}s   | "
                  f"{dist_total:>10.1f}m | "
                  f"{dist_delta:>6.2f}m | "
                  f"{pace_str:<8} | "
                  f"{int(hr) if hr else 'N/A':>5} | "
                  f"{elev:>6.1f}m")
                 
    else:
        print("No processed streams found")


def main():
    session = SessionLocal()

    seconds = (
        session.query(ActivitySecond)
        .filter_by(activity_id=ACTIVITY_ID)
        .order_by(ActivitySecond.second_index)
        .all()
    )

    processed_activity = process_activity_streams_pd(seconds)
    validate_processed_streams(processed_activity)
    
if __name__ == "__main__":
    main()