import os
import webbrowser
import requests
from dotenv import load_dotenv

from token_manager import save_tokens

load_dotenv()

CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI")

AUTH_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"

def authorize():
    url = (
        f"{AUTH_URL}"
        f"?client_id={CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={REDIRECT_URI}"
        f"&approval_prompt =force"
        f"&scope=activity:read_all"
    )
    
    print("opening browser for authorization")
    webbrowser.open(url)
    
def exchange_code_for_token(code):
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    }
    
    response = requests.post(TOKEN_URL, data = payload)
    response.raise_for_status()
    return response.json()

if __name__ == "__main__":
    authorize()
    code = input("Write here the 'code' from strava: ")
    token_data = exchange_code_for_token(code)
    save_tokens(token_data)
    print("Tokens saved")