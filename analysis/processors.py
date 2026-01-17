import pandas as pd

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from collector.activities import fetch_activities

def format_seconds(seconds):
    if pd.isna(seconds):
        return  "00:00:00"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    sec = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{sec:02d}"
    else:
        return f"{minutes:02d}:{sec:02d}"
    
def format_pace(pace_decimal):
    if pd.isna(pace_decimal) or pace_decimal == float("inf"):
        return "0:00"
    
    minutes = int(pace_decimal)
    seconds = int((pace_decimal - minutes) * 60)
    return f"{minutes}:{seconds:02d}"

def activities_to_dataframe(activities):
    df = pd.DataFrame(activities)
    
    if df.empty:
        return df
    
    df["start_date"] = pd.to_datetime(df["start_date"])
    df["start_date"] = df["start_date"].dt.tz_convert("America/Sao_Paulo").dt.tz_localize(None)
    
    df["distance_km"] = df["distance"] / 1000
    df["moving_time_min"] = df["moving_time"] / 60
    df["raw_pace"] = df["moving_time_min"] / df["distance_km"]
    
    extra_columns = {
        "total_elevation_gain": "elevation_gain",
        "average_heartrate": "average_bpm",
        "max_heartrate": "max_bpm"
    }
    
    df = df.rename(columns={k: v for k, v in extra_columns.items() if k in df.columns})
    
    return df

def show_formated_data(df):
    df["start_date_formated"] = df["start_date"].dt.strftime("%d/%m/%Y %H:%M")
    df["pace_min_km"] = df["raw_pace"].apply(format_pace)
    df["moving_time"] = df["moving_time"].apply(format_seconds)
    
    columns_for_exhibition = [
        "name",
        "type",
        #"sport_type",
        "start_date_formated",
        "distance_km",
        "moving_time",
        "pace_min_km",
        "elevation_gain",
        "average_bpm",
        "max_bpm"
    ]
    
    columns_to_be_printed = [c for c in columns_for_exhibition if c in df.columns]
    
    print(df[columns_to_be_printed])
    
if __name__ == "__main__":
    activities = fetch_activities(per_page=10)
    df = activities_to_dataframe(activities)
    show_formated_data(df)