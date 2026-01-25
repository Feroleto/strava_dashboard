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

def process_z2_and_total_distances(df_total, df_z2, hide_zero=False, limit=None):
    df = pd.merge(
        df_total[["week_start", "total_km", "label"]],
        df_z2[["week_start", "z2_km"]],
        on="week_start",
        how="left"
    ).fillna(0)
    
    if hide_zero:
        df = df[df["total_km"] > 0].copy()
        
    if limit:
        df = df.tail(limit).copy()
        
    return df

def process_weekly_training_load(raw_data, zones):
    df = pd.DataFrame(
        raw_data,
        columns=["week_start", "pace_min_km", "distance_km"]
    )
    
    df = df.drop_duplicates()
    
    if df.empty:
        return df
    
    records = []
    
    for week, week_df in df.groupby("week_start"):
        total_load = 0
        zone_breakdown = {}
        
        for name, z_min, z_max, weight in zones:
            zone_km = week_df[
                (week_df["pace_min_km"] >= z_min) &
                (week_df["pace_min_km"] <= z_max)
            ]["distance_km"].sum()
            
            load = zone_km * weight
            zone_breakdown[name] = load
            total_load += load
            
        record = {
            "week_start": week,
            "training_load": total_load,
            **zone_breakdown
        }
        
        records.append(record)
        
    df = pd.DataFrame(records)
    df["week_start"] = pd.to_datetime(df["week_start"])
    df = df.sort_values("week_start")
    
    df["label"] = df["week_start"].dt.strftime("%d/%m/%y")
    
    return df

def process_acwr(df_load, acute_window=1, chronic_window=4):
    if df_load.empty:
        return df_load
    
    df = df_load.copy()
    df = df.sort_values("week_start")
    
    
    df["acute_load"] = (
        df["training_load"]
        .rolling(window=acute_window, min_periods=1)
        .mean()
    )
    
    df["chronic_load"] = (
        df["training_load"]
        .rolling(window=chronic_window, min_periods=1)
        .mean()
    )
    
    df["acwr"] = df["acute_load"] / df["chronic_load"]
    df["acwr"] = df["acwr"].replace([float("inf")], None)
    
    return df

def process_daily_training_load(raw_splits, zones):
    df = pd.DataFrame(
        raw_splits,
        columns=["date", "pace_min_km", "distance_km"])
    
    if df.empty:
        return df
    
    df["date"] = pd.to_datetime(df["date"]).dt.date
    
    df["zone_weight"] = 0.0
    
    for _, z_min, z_max, weight in zones:
        mask = (
            (df["pace_min_km"] >= z_min) &
            (df["pace_min_km"] <= z_max)
        )
        df.loc[mask, "zone_weight"] = weight
        
    df["split_load"] = df["distance_km"] * df["zone_weight"]
    
    daily_load = (
        df.groupby("date")["split_load"]
        .sum()
        .reset_index()
        .rename(columns={"split_load": "training_load"})
    )
    
    return daily_load

def process_monotony_strain(daily_load):
    if daily_load.empty:
        return pd.DataFrame()
    
    df = daily_load.copy()
    df["date"] = pd.to_datetime(df["date"])
    
    all_days = pd.date_range(
        start=df["date"].min(),
        end=df["date"].max(),
        freq='D'
    )
    df = df.set_index("date").reindex(all_days, fill_value=0).reset_index()
    df.rename(columns={"index": "date"}, inplace=True)
        
    df["week_start"] = df["date"] - pd.to_timedelta(df["date"].dt.weekday, unit="d")
    
    records = []
    for week, wdf in df.groupby("week_start"):
        loads = wdf["training_load"]
        
        mean_load = loads.mean()
        std_load = loads.std()
        
        monotony = mean_load / std_load if (std_load > 0 and mean_load > 0) else 1.0
        weekly_load = loads.sum()
        strain = weekly_load * monotony
        
        records.append({
            "week_start": week,
            "weekly_load": weekly_load,
            "monotony": monotony,
            "strain": strain
        })
        
        print(f"Semana {week}: Dias com treino = {(wdf['training_load'] > 0).sum()} / Total dias = {len(wdf)}")
        
    out = pd.DataFrame(records)
    out = out[out["weekly_load"] > 0].copy()
    out["label"] = out["week_start"].dt.strftime("%d/%m/%y")
    
    return out
