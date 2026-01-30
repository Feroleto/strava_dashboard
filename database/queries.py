from sqlalchemy import func

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import SessionLocal
from database.models import Activity, ActivitySplit, ActivitySecond
from utils.constants import STREAM_WORKOUT_TYPES, WORKOUT_EASY_OR_LONG

def fetch_individual_activity_data():
    session = SessionLocal()
    
    try:
        query = (
            session.query(
                Activity.distance_km,
                Activity.moving_time_sec
            )
            .filter(Activity.type == "Run")
            .filter(Activity.distance_km > 0)
            .filter(Activity.moving_time_sec > 0)
            .all()
        )
        return query
    finally:
        session.close()
        
def fetch_weekly_data():
    session = SessionLocal()
    
    try:
        query = (
            session.query(
                func.date(Activity.start_date, "weekday 0", "-6 days").label("week_start"),
                func.sum(Activity.distance_km).label("total_km"),
                func.sum(Activity.moving_time_sec).label("total_time_sec")
            )
            .filter(Activity.type == "Run")
            .group_by("week_start")
            .order_by("week_start")
            .all()
        )
        return query
    finally:
        session.close()
        
def get_activities_without_splits(session):
    return (
        session.query(Activity)
        .outerjoin(ActivitySplit)
        .filter(Activity.type == "Run")
        .filter(ActivitySplit.id.is_(None))
        .filter(Activity.workout_type == WORKOUT_EASY_OR_LONG)
        .all()
    )
    
def get_last_activity_timestamp():
    session = SessionLocal()
    try:
        last_activity = session.query(Activity).order_by(Activity.start_date.desc()).first()
        if last_activity:
            return int(last_activity.start_date.timestamp())
        return None
    finally:
        session.close()
        
def fetch_split_pace():
    session = SessionLocal()
    try:
        return session.query(
            ActivitySplit.pace_min_km,
            ActivitySplit.distance_km
        ).all()
    finally:
        session.close()
        
def fetch_weekly_splits():
    session = SessionLocal()
    try:
        return (
            session.query(
                func.date(Activity.start_date, "weekday 0", "-6 days").label("week_start"),
                ActivitySplit.pace_min_km,
                ActivitySplit.distance_km
            )
            .join(Activity, Activity.id == ActivitySplit.activity_id)
            .all()
        )
    finally:
        session.close()
        
def fetch_daily_splits():
    session = SessionLocal()
    try:
        return (
            session.query(
                func.date(Activity.start_date).label("date"),
                ActivitySplit.pace_min_km,
                ActivitySplit.distance_km
            )
            .join(Activity, Activity.id == ActivitySplit.activity_id)
            .filter(Activity.type == "Run")
            .all()
        )
    finally:
        session.close()
        
def get_activities_requiring_streams(session):
    return (
        session.query(Activity)
        .filter(Activity.workout_type.in_(STREAM_WORKOUT_TYPES))
        .all()
    )
    
def activity_has_streams(session, activity_id):
    return (
        session.query(ActivitySecond.id)
        .filter(ActivitySecond.activity_id == activity_id)
        .first()
        is not None
    )
    
def removing_activities_complete(activity_id):
    session = SessionLocal()
    try:
        activity = (
            session.query(Activity)
            .filter_by(id=activity_id)
            .first()
        )
        
        if activity:
            session.delete(activity)
            session.commit()
    
    except Exception as e:
        session.rollback()
    finally:
        session.close()
        
def main():
    removing_activities_complete()
    
if __name__ == "__main__":
    main()