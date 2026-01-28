from database.config import SessionLocal, get_db_info
from database.models import Activity, ActivitySplit, ActivitySecond
from sqlalchemy import func

def check_ingestion_summary():
    session = SessionLocal()
    print("-" * 50)
    print(get_db_info())
    print("-" * 50)

    # 1. Busca todas as atividades no banco
    activities = session.query(Activity).order_by(Activity.start_date.desc()).all()

    if not activities:
        print("O banco está vazio.")
        return

    print(f"{'ID':<15} | {'Nome':<20} | {'Tipo':<10} | {'Splits':<7} | {'Streams':<7}")
    print("-" * 70)

    for act in activities:
        # Conta quantos splits e quantos segundos existem para esta atividade
        num_splits = session.query(func.count(ActivitySplit.id)).filter_by(activity_id=act.id).scalar()
        num_streams = session.query(func.count(ActivitySecond.id)).filter_by(activity_id=act.id).scalar()
        
        # Formata os nomes longos para não quebrar a tabela
        name = (act.name[:17] + '..') if len(act.name) > 17 else act.name
        
        print(f"{act.id:<15} | {name:<20} | {act.workout_type or 'run':<10} | {num_splits:<7} | {num_streams:<7}")

    session.close()

if __name__ == "__main__":
    check_ingestion_summary()