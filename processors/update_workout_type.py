import time
from tqdm import tqdm

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import SessionLocal
from database.models import Activity
from processors.activity_classifier import classify_workout
from collector.activities import get_activity_by_id

def update_workout_type():
    session = SessionLocal()
    
    try:
        activities = (
            session.query(Activity)
            .filter(Activity.workout_type.is_(None))
            .all()
        )
        
        if not activities:
            print("Don't have activites to update")
            return
        
        
        for i, activity in enumerate(tqdm(activities, desc="Classifying workouts", unit="actv"), start=1):
            try:
                api_activity = get_activity_by_id(activity.id)
                workout_type = classify_workout(api_activity)
            
                activity.workout_type = workout_type
            
                if i % 20 == 0:
                    session.commit()
                    time.sleep(1)
            
            except Exception as e:
                print(f"Error to process activity {activity.id}: {e}")
                continue
                
        session.commit()
        print("Workout types update with success")
        
    except Exception as e:
        session.rollback()
        raise e
    
    finally:
        session.close()
        
if __name__ == "__main__":
    update_workout_type()
            