import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.config import DATABASE_PATH, IS_TEST_MODE, engine
from database.models import Base

def reset_database():
    print("-" * 40)
    print(f"Target: {DATABASE_PATH}")
    
    if not IS_TEST_MODE:
        confirm = input("WARNING: You are using the MAIN db! You are sure that you want to DELETE? (y/n): ")
        if confirm.lower() != 'y':
            print("Stoping operation")
            return
        
    if os.path.exists(DATABASE_PATH):
        try:
            os.remove(DATABASE_PATH)
            print(f"File: {os.path.basename(DATABASE_PATH)} deleted")
        except Exception as e:
            print(f"Error to remove file: {e}")
            return
    
    else:
        print("The db file didn't exist")
        
    print("Recreating tables")
    try:
        Base.metadata.create_all(engine)
        print("Database reseted and ready to use")
    except Exception as e:
        print(f"Error to create tables: {e}")
        
    print("-" * 40)
    
if __name__ == "__main__":
    reset_database()