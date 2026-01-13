from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

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
    
    
def create_tables():
    Base.metadata.create_all(engine)