from sqlalchemy import func
from database.config import SessionLocal
from database.models import Activity, ActivitySplit

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
        .all()
    )