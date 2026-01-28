import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.config import Base, engine, get_db_info 
from models import Activity, ActivitySplit, ActivitySecond

def create_tables():
    print(get_db_info())
    print("-" * 30)
    Base.metadata.create_all(engine)
    print("creating tables")
    
if __name__ == "__main__":
    create_tables()