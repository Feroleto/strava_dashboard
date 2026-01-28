import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import SessionLocal
from database.models import Activity, ActivitySplit
from database.queries import activity_has_streams
from utils.constants import STREAM_WORKOUT_TYPES

def removing_splits_for_stream_activities():
    session = SessionLocal()
    
    try:
        activities = (
            session.query(Activity)
            .filter(Activity.workout_type.in_(STREAM_WORKOUT_TYPES))
            .all()
        )
        
        removed = 0
        
        for activity in activities:
            if not activity_has_streams(session, activity.id):
                continue
            
            deleted = (
                session.query(ActivitySplit)
                .filter(ActivitySplit.activity_id == activity.id)
                .delete(synchronize_session=False)
            )
            
            removed += deleted
            
        session.commit()
        print(f"{removed} splits removed")
        
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        
    finally:
        session.close()
        
def main():
    removing_splits_for_stream_activities()
    
if __name__ == "__main__":
    main()