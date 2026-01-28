import requests

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from auth.token_manager import get_valid_access_token

BASE_URL = "https://www.strava.com/api/v3"

def fetch_activity_streams(activity_id, access_token=None):
    if not access_token:
        access_token = get_valid_access_token()
        
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    params = {
        "keys": "time,distance,velocity_smooth,heartrate,altitude",
        "key_by_type": "true"
    }
    
    response = requests.get(
        f"{BASE_URL}/activities/{activity_id}/streams",
        headers=headers,
        params=params
    )
    
    response.raise_for_status()
    return response.json()
    