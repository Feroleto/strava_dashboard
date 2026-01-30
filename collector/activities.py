import requests
import time

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from auth.token_manager import get_valid_access_token

BASE_URL = "https://www.strava.com/api/v3"

def _get_headers():
    token = get_valid_access_token()
    return {
        "Authorization": f"Bearer {token}"
    }

def fetch_activities(per_page = 30, page = 1, after=None):
    headers = _get_headers()
    
    params = {
        "per_page": per_page,
        "page": page
    }
    
    if after:
        params["after"] = after
    
    response = requests.get(
        f"{BASE_URL}/athlete/activities",
        headers=headers,
        params=params
    )
    
    response.raise_for_status()
    
    return response.json()

def get_all_activities(per_page = 200, after=None):
    all_activities = []
    page = 1
    
    while True:
        activities = fetch_activities(
            per_page=per_page, 
            page=page, 
            after=after
        )
        
        if not activities:
            break
        
        all_activities.extend(activities)
        page += 1
    
    return all_activities

def get_activity_by_id(activity_id: int, sleep_sec: float = 0.3):
    headers = _get_headers()
    
    response = requests.get(
        f"{BASE_URL}/activities/{activity_id}",
        headers=headers
    )
    
    response.raise_for_status()
    
    time.sleep(sleep_sec)
    
    return response.json()