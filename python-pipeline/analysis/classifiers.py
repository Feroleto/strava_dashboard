import requests
import re

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from auth.token_manager import get_valid_access_token
from collector.activities import fetch_activities

BASE_URL = "https://www.strava.com/api/v3"

def is_interval_workout(activity):
    description = activity.get("description", "")
    description = description.lower() if description else ""
    
    KEYWORDS = ["tiro", "interval", "splits", "hill", "repeats", "subida"]
    if any(k in description for k in KEYWORDS):
        return True
    
    # search for: 10x400, 5 x 1000, 8X1km
    series_pattern = r'\d+\s*[xX*]\s*\d+'
    if re.search(series_pattern, description):
        return True
    
    # search for: 5x3', 10 x 1:30
    time_pattern = r'\d+\s*[xX]\s*\d+[:\']'
    if re.search(time_pattern, description):
        return True
    
    return False

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
    activities_list = fetch_activities(per_page=10)
    
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