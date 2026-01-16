import requests
import time
from auth.token_manager import get_valid_access_token

BASE_URL = "https://www.strava.com/api/v3"

def fetch_activity_splits(activity_id, access_token=None):
    if not access_token:
        access_token = get_valid_access_token()
    
    url = f"{BASE_URL}/activities/{activity_id}"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    r = requests.get(url, headers=headers)
        
    if r.status_code == 429:
        print("Rate limit hit. Sleeping for 15 minutes...")
        time.sleep(15 * 60)
        return fetch_activity_splits(activity_id, access_token)
        
    r.raise_for_status()
    data = r.json()
    
    return data.get("splits_metric", [])