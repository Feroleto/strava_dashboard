from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///strava.db"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    type = Column(String)
    sport_type = Column(String)
    
    start_date = Column(DateTime)
    
    distance_km = Column(Float)
    
    moving_time_sec = Column(Float)
    
    pace_raw = Column(Float)
    
    elevation_gain = Column(Float)
    average_bpm = Column(Float)
    max_bpm = Column(Float)
    
    splits = relationship("ActivitySplit", back_populates="activity")
    
class ActivitySplit(Base):
    __tablename__ = "activity_splits"
    
    id = Column(Integer, primary_key=True)
    
    activity_id = Column(Integer, ForeignKey("activities.id"), index=True)
    
    split_index = Column(Integer)
    distance_km = Column(Float)
    moving_time_sec = Column(Integer)
    pace_min_km = Column(Float)
    
    activity = relationship("Activity", back_populates="splits")
    
def create_tables():
    Base.metadata.create_all(engine)