import os
import time
import requests
from dotenv import load_dotenv, set_key

load_dotenv()

CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
TOKEN_URL = "https://www.strava.com/oauth/token"
ENV_FILE = ".env"

def save_tokens(token_data):
    set_key(ENV_FILE, "STRAVA_ACCESS_TOKEN", token_data["access_token"])
    set_key(ENV_FILE, "STRAVA_REFRESH_TOKEN", token_data["refresh_token"])
    set_key(ENV_FILE, "STRAVA_EXPIRES_AT", str(token_data["expires_at"]))
    
    #load_dotenv(override=True)
    
def is_token_expired():
    #load_dotenv(override=True)
    expires_at = os.getenv("STRAVA_EXPIRES_AT")
    if not expires_at:
        return True
    return time.time() > int(expires_at)

def refresh_access_token():
    refresh_token = os.getenv("STRAVA_REFRESH_TOKEN")
    
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    
    response = requests.post(TOKEN_URL, data = payload)
    response.raise_for_status()
    
    token_data = response.json()
    save_tokens(token_data)
    return token_data["access_token"]

def get_valid_access_token():
    if is_token_expired():
        print("Expired token - renewing...")
        return refresh_access_token()
    return os.getenv("STRAVA_ACCESS_TOKEN")

def check_token_scopes():
    load_dotenv(override=True)
    token = os.getenv("STRAVA_ACCESS_TOKEN")
    
    url = "https://www.strava.com/api/v3/athlete"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        print("Token is valid and the conection is active")
        print("If 401 is only on splits, you need to re-activate with 'activity:read_all'")
    else:
        print(f"Error the validate token: {response.status_code}")
        print(response.json())
        
if __name__ == "__main__":
    check_token_scopes()
    