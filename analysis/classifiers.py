import requests
import re

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from auth.token_manager import get_valid_access_token
from collector.activities import fetch_activities

BASE_URL = "https://www.strava.com/api/v3"
INTERVAL_DIFFERENCE_LIMIT = 120

def format_pace_from_seconds(total_seconds):
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    return f"{minutes}:{seconds:02d} min/km" 

def is_interval_workout(activity):
    avg_speed = activity["average_speed"]
    max_speed = activity["max_speed"]
    
    description = activity.get("description", "")
    description = description.lower() if description else ""
    
    if not avg_speed or not max_speed:
        return False
    
    pace_avg = 1000 / avg_speed
    pace_best = 1000 / max_speed
    delta_pace = pace_avg - pace_best
    
    pace_based = delta_pace > INTERVAL_DIFFERENCE_LIMIT
    
    text_based = False
    
    KEYWORDS = ["tiro", "interval", "200", "400", "500", "800", "1000"]
    
    if any(k in description for k in KEYWORDS):
        text_based = True
        
    if pace_based:
        avg_pace = format_pace_from_seconds(pace_avg)
        best_pace = format_pace_from_seconds(pace_best)
        print(f"pace based | avg pace = {avg_pace} | best pace = {best_pace}")
        
    if (text_based):
        print("description")
        
    return pace_based or text_based

def fetch_activity_detail(activity_id):
    token = get_valid_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/activities/{activity_id}",
        headers=headers
    )
    response.raise_for_status()
    return response.json()

def main():
    print("Searching for activities")
    activities_list = fetch_activities(per_page=40)
    
    processed_activities = []
    
    for summary in activities_list:
        if summary["type"] == "Run":
            try:
                detail = fetch_activity_detail(summary["id"])
                is_interval = is_interval_workout(detail)
                
                detail["is_interval"] = is_interval
                processed_activities.append(detail)
                
                status = "Interval Training" if is_interval else "base or long run"
                print(f"ID: {detail["id"]} | {status} | Title: {detail["name"]}")
                
            except Exception as e:
                print(f"Error to process activity {summary["id"]}: {e}")
                
if __name__ == "__main__":
    main()