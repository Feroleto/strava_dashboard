import pandas as pd
import numpy as np

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
    
def process_pace_histogram_data(raw_data, pace_max=4.0, pace_min=8.0, bin_size=0.25):
    df = pd.DataFrame(
        raw_data,
        columns=["distance_km", "moving_time_sec"]
    )
    
    if df.empty:
        return df
    
    # pace for activity
    df["pace_min_km"] = (df["moving_time_sec"] / 60) / df["distance_km"]
        
    # filters
    df = df[
        (df["pace_min_km"] <= pace_min) &
        (df["pace_min_km"] >= pace_max)
    ].copy()
    
    bins = np.arange(pace_max, pace_min + bin_size, bin_size)
    df["pace_bin"] = pd.cut(
        df["pace_min_km"],
        bins=bins,
        right=False
    )
    
    # sum 
    df_grouped = (
        df.groupby("pace_bin", observed=True)["distance_km"]
        .sum()
        .reset_index()
    )
    
    # labels
    def format_pace_bin(interval):
        start = interval.left
        end = interval.right
        return f"{int(start)}:{int((start%1)*60):02d}-{int(end)}:{int((end%1)*60):02d}"
    
    df_grouped["label"] = df_grouped["pace_bin"].apply(format_pace_bin)
    
    return df_grouped

def process_weekly_data(raw_data, hide_zero=False, limit=None):
    df = pd.DataFrame(
        raw_data,
        columns=["week_start", "total_km", "total_time_sec"]
    )
    
    if df.empty:
        return df
    
    df["week_start"] = pd.to_datetime(df["week_start"])
    
    # filling 0 weeks
    all_weeks = pd.date_range(
        start=df["week_start"].min(),
        end=df["week_start"].max(),
        freq="W-MON"
    )
    df = df.set_index("week_start").reindex(all_weeks, fill_value=0).reset_index()
    df.columns = ["week_start", "total_km", "total_time_sec"]
    
    # pace
    df["pace_min_km"] = (df["total_time_sec"] / 60) / df["total_km"]
    df["pace_min_km"] = df["pace_min_km"].replace([float("inf")], None)
    
    # filters
    if hide_zero:
        df = df[df["total_km"] > 0].copy()
        
    if limit:
        df = df.tail(limit).copy()
        
    df["label"] = df["week_start"].dt.strftime("%d/%m/%y")
    return df
    
if __name__ == "__main__":
    activities = fetch_activities(per_page=10)
    df = activities_to_dataframe(activities)
    show_formated_data(df)