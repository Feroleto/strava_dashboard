from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os

IS_TEST_MODE = os.environ.get("STRAVA_TEST_MODE") == "1"
DB_NAME = "strava_test.db" if IS_TEST_MODE else "strava.db"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "..", DB_NAME)
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

def get_db_info():
    mode = "TEST DB" if IS_TEST_MODE else "MAIN DB"
    return f"Mode: {mode} | DATABASE: {DATABASE_PATH}"

# to use the TEST database
# $env:STRAVA_TEST_MODE="1"; python seu_script.py

# to use the MAIN database
# $env:STRAVA_TEST_MODE="0"; python seu_script.py