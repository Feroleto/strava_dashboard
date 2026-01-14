from sqlalchemy import func
import matplotlib.pyplot as plt
import pandas as pd
import argparse
import matplotlib.ticker as ticker

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.db import SessionLocal, Activity

def fetch_weekly_pace_data():
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
        
def process_pace_data(raw_pace_data, hide_zero=False, limit=None):
    df = pd.DataFrame(
            raw_pace_data, 
            columns=["week_start", "total_km", "total_time_sec"]
    )
    
    if df.empty:
        return df
    
    df["week_start"] = pd.to_datetime(df["week_start"])
    
    all_weeks = pd.date_range(
        start = df["week_start"].min(),
        end = df["week_start"].max(),
        freq = "W-MON"
    )
    
    df = df.set_index("week_start").reindex(all_weeks).reset_index()
    df.columns = ["week_start", "total_km", "total_time_sec"]
    
    df[["total_km", "total_time_sec"]] = df[["total_km", "total_time_sec"]].fillna(0)
    
    if hide_zero:
        df = df[df["total_km"] > 0].copy()
        
    if limit:
        df = df.tail(limit).copy()
        
    df["pace_min_km"] = (df["total_time_sec"] / 60) / df["total_km"]
    df["pace_min_km"] = df["pace_min_km"].replace([float("inf")], None)
    
    df["label"] = df["week_start"].dt.strftime("%d/%m/%y")
    
    return df

def plot_weekly_pace(df):
    if df.empty:
        print("None pace data was found")
        return
    
    weeks = df["label"]
    pace = df["pace_min_km"]
    
    plt.style.use("seaborn-v0_8-muted")
    fig, ax = plt.subplots(figsize=(12, 6))
    
    ax.plot(
        weeks,
        pace,
        color="darkgreen",
        marker='o',
        linestyle='-',
        linewidth=2
    )
    
    def format_pace_y(x, pos):
        minutes = int(x)
        seconds = int((x - minutes) * 60)
        return f"{minutes}:{seconds:02d}"
    
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(format_pace_y))
    
    ax.set_title("Weekly average pace", fontsize=16, fontweight="bold", pad=20)
    ax.set_ylabel("Pace (min/km)", fontsize=12)
    
    ax.invert_yaxis()
    
    ax.yaxis.grid(True, linestyle="--", alpha=0.7)
    ax.xaxis.grid(False)
    
    plt.xticks(rotation=45)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    
    plt.tight_layout()
    plt.show()
    
def main():
    parser = argparse.ArgumentParser(description="Weekly pace analysis")
    parser.add_argument("--hide_zero", action="store_true", help="Hide weeks without runs")
    parser.add_argument("--limit", type=int, default=None, help="Weeks limitl")
    args = parser.parse_args()
    
    raw_pace_data = fetch_weekly_pace_data()
    df_processed_pace = process_pace_data(raw_pace_data, hide_zero=args.hide_zero, limit=args.limit)
    plot_weekly_pace(df_processed_pace)
    
if __name__ == "__main__":
    main()