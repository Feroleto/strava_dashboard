import requests

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from collector.utils import BASE_URL, get_headers

def fetch_activity_streams(activity_id):
    headers =  get_headers()
    
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
    