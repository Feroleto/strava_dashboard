import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.config import SessionLocal
from database.models import ActivitySecond

def get_streams(activity_id):
    session = SessionLocal()
    
    streams = (
        session.query(ActivitySecond)
        .filter_by(activity_id=activity_id)
        .order_by(ActivitySecond.second_index)
        .all()
    )
    
    return streams
    