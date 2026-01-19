import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from collector.activities import fetch_activities
from analysis.formatters import format_pace, format_seconds
from analysis.processors import activities_to_dataframe

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