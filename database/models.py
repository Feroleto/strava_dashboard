from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from config import Base

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
    
    splits = relationship("ActivitySplit", back_populates="activity", cascade="all, delete-orphan")
    
class ActivitySplit(Base):
    __tablename__ = "activity_splits"
    
    id = Column(Integer, primary_key=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), index=True)
    split_index = Column(Integer)
    distance_km = Column(Float)
    moving_time_sec = Column(Integer)
    pace_min_km = Column(Float)
    
    activity = relationship("Activity", back_populates="splits")
    
'''
def create_tables():
    Base.metadata.create_all(engine)
    print("creating tables")
    
if __name__ == "__main__":
    create_tables()
'''