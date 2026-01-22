import pandas as pd
import numpy as np

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from analysis.formatters import format_pace_bin

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
    
def process_pace_histogram_data(raw_data, pace_max=3.0, pace_min=9.0, bin_size=0.25):
    df = pd.DataFrame(
        raw_data,
        columns=["distance_km", "moving_time_sec"]
    )
    
    if df.empty:
        return df
    
    # pace per activity
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
    
    df_grouped["label"] = df_grouped["pace_bin"].apply(format_pace_bin)
    
    return df_grouped

def process_splits_pace_histogram(raw_splits, pace_max=3.0, pace_min=20.0, bin_size=0.25):
    df = pd.DataFrame(
        raw_splits,
        columns=["pace_min_km", "distance_km"]
    )
    
    df.dropna()
    
    if df.empty:
        return df
    
    # filters
    df = df[
        (df["pace_min_km"] >= pace_max) &
        (df["pace_min_km"] <= pace_min)
    ].copy()
    
    bins = np.arange(pace_max, pace_min + bin_size, bin_size)
    
    df["pace_bin"] = pd.cut(
        df["pace_min_km"],
        bins=bins,
        right=False
    )
    
    df_grouped = (
        df.groupby("pace_bin", observed=True)["distance_km"]
        .sum()
        .reset_index()
    )
    
    df_grouped["label"] = df_grouped["pace_bin"].apply(format_pace_bin)
    
    return df_grouped

def process_z2_percentage(raw_data, z2_min, z2_max):
    df = pd.DataFrame(
        raw_data,
        columns=["week_start", "pace_min_km", "distance_km"]
    )
    
    df.dropna()
    
    if df.empty:
        return df
    
    df["week_start"] = pd.to_datetime(df["week_start"])
    
    df["is_z2"] = (
        (df["pace_min_km"] > z2_min) &
        (df["pace_min_km"] <= z2_max)
    )
    
    df["z2_km"] = df["distance_km"].where(df["is_z2"], 0)
    
    weekly = df.groupby("week_start", as_index=False).agg(
        total_km=("distance_km", "sum"),
        z2_km=("z2_km", "sum")
    )
    
    weekly["z2_percentage"] = 100 * weekly["z2_km"] / weekly["total_km"]
    
    weekly.rename(columns={"index": "week_start"}, inplace=True)
    weekly["label"] = weekly["week_start"].dt.strftime("%d/%m/%y")
    return weekly

def process_z2_volume(raw_data, z2_min, z2_max):
    df = pd.DataFrame(
        raw_data,
        columns=["week_start", "pace_min_km", "distance_km"])

    df = df.drop_duplicates()
    
    if df.empty:
        return df
    
    df["week_start"] = pd.to_datetime(df["week_start"])
    
    df["is_z2"] = (
        (df["pace_min_km"] >= z2_min) &
        (df["pace_min_km"] <= z2_max)
    )
    
    df["z2_km"] = df["distance_km"].where(df["is_z2"], 0)
    
    weekly = df.groupby("week_start", as_index=False).agg(
        total_km=("distance_km", "sum"),
        z2_km=("z2_km", "sum")
    )
    
    weekly.rename(columns={"index": "week_start"}, inplace=True)
    weekly["label"] = weekly["week_start"].dt.strftime("%d/%m/%y")
    
    return weekly