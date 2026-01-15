import pandas as pd
from sqlalchemy import func

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.db import SessionLocal, Activity

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
    df = df.set_index("week_start").reindex(all_weeks).reset_index()
    df.columns = ["week_start", "total_km", "total_time_sec"]
    
    # pace
    df["pace_min_km"] = (df["total_time_sec"] / 60) / df["total_km"]
    df["pace_min_km"] = df["pace_min_km"].replace([float("inf")], None)
    
    # filters
    if limit:
        df = df.tail(limit).copy()
        
    if hide_zero:
        df = df[df["total_km"] > 0].copy()
        
    df["label"] = df["week_start"].dt.strftime("%d/%m/%y")
    return df