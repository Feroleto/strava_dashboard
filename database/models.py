from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import Base

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    workout_type = Column(String, index=True)
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
    seconds = relationship("ActivitySecond", back_populates="activity", cascade="all, delete-orphan")
    
class ActivitySplit(Base):
    __tablename__ = "activity_splits"
    
    id = Column(Integer, primary_key=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), index=True)
    split_index = Column(Integer)
    distance_km = Column(Float)
    moving_time_sec = Column(Integer)
    pace_min_km = Column(Float)
    
    activity = relationship("Activity", back_populates="splits")
    
class ActivitySecond(Base):
    __tablename__ = "activity_seconds"
    
    id = Column(Integer, primary_key=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), index=True)
    second_index = Column(Integer)
    distance_m = Column(Float)
    speed_m_s = Column(Float)
    pace_sec_km = Column(Float)
    elevation_m = Column(Float)
    heart_rate = Column(Integer)
    
    activity = relationship("Activity", back_populates="seconds")