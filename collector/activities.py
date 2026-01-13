import requests
import pandas as pd

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from auth.token_manager import get_valid_access_token

BASE_URL = "https://www.strava.com/api/v3"

def get_activities(per_page = 30, page = 1):
    token = get_valid_access_token()
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    params = {
        "per_page": per_page,
        "page": page
    }
    
    response = requests.get(
        f"{BASE_URL}/athlete/activities",
        headers=headers,
        params=params
    )
    
    response.raise_for_status()
    
    return response.json()

def format_seconds(seconds):
    if pd.isna(seconds):
        return "00:00:00"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes:02d}:{seconds:02d}"

    
def activities_to_dataframe(activities):
    df = pd.DataFrame(activities)
    
    if df.empty:
        return df
    
    df["start_date"] = pd.to_datetime(df["start_date"])
    df["start_date"] = df["start_date"].dt.tz_convert("America/Sao_Paulo").dt.tz_localize(None)
    df["start_date_formated"] = df["start_date"].dt.strftime("%d/%m/%Y %H:%M")
    
    df["distance_km"] = df["distance"] / 1000
    df["moving_time_min"] = df["moving_time"] / 60
    
    raw_pace = df["moving_time_min"] / df["distance_km"]
    
    def format_pace(pace_decimal):
        if pd.isna(pace_decimal) or pace_decimal == float('inf'):
            return "0:00"
        minutes = int(pace_decimal)
        seconds = int((pace_decimal - minutes) * 60)
        return f"{minutes}:{seconds:02d}"
    
    df["pace_min_km"] = raw_pace.apply(format_pace)
    df["moving_time"] = df["moving_time"].apply(format_seconds)
    
    extra_columns = {
        "total_elevation_gain": "elevation_gain",
        "average_heartrate": "average_bpm",
        "max_heartrate": "max_bpm"
    }
    
    df = df.rename(columns={k: v for k, v in extra_columns.items() if k in df.columns})
    
    return df

def get_all_activities(per_page = 200):
    all_activities = []
    page = 1
    
    while True:
        activities = get_activities(per_page = per_page, page = page)
        if not activities:
            break
        
        all_activities.extend(activities)
        page += 1
    
    return all_activities

if __name__ == "__main__":
    activities = get_activities(per_page=10)
    df = activities_to_dataframe(activities)
    
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
