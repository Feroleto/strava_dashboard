import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from auth.token_manager import get_valid_access_token

BASE_URL = "https://www.strava.com/api/v3"

def get_headers():
    access_token = get_valid_access_token()
    return {
        "Authorization": f"Bearer {access_token}"
    }