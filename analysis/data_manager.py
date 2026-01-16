import pandas as pd
from sqlalchemy import func
import numpy as np

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.db import SessionLocal, Activity

def fetch_individual_activity_data():
    session = SessionLocal()
    
    try:
        query = (
            session.query(
                Activity.distance_km,
                Activity.moving_time_sec
            )
            .filter(Activity.type == "Run")
            .filter(Activity.distance_km > 0)
            .filter(Activity.moving_time_sec > 0)
            .all()
        )
        return query
    finally:
        session.close()

def fetch_weekly_data():
    session = SessionLocal()
    
    try:
        query = (
            session.query(
                func.date(Activity.start_date, "weekday 0", "-6 days").label("week_start"),
                func.sum(Activity.distance_km).label("total_km"),
                func.sum(Activity.moving_time_sec).label("total_time_sec")
            )
            .filter(Activity.type == "Run")
            .group_by("week_start")
            .order_by("week_start")
            .all()
        )
        return query
    finally:
        session.close()
        
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
    
def process_raw_data(raw_data, hide_zero=False, limit=None):
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