from database.config import Base, engine 

def create_tables():
    Base.metadata.create_all(engine)
    print("creating tables")
    
if __name__ == "__main__":
    create_tables()