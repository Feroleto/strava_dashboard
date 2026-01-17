import requests

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from auth.token_manager import get_valid_access_token

BASE_URL = "https://www.strava.com/api/v3"

def fetch_activities(per_page = 30, page = 1, after=None):
    token = get_valid_access_token()
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
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
        activities = fetch_activities(per_page=per_page, page=page, after=after)
        if not activities:
            break
        
        all_activities.extend(activities)
        page += 1
    
    return all_activities