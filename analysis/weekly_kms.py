from sqlalchemy import func
import matplotlib.pyplot as plt

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.db import SessionLocal, Activity

session = SessionLocal()

weekly_km = (
    session.query(
        func.strftime("%Y-%W", Activity.start_date).label("year_week"),
        func.sum(Activity.distance_km).label("total_km")
    )
    .group_by("year_week")
    .order_by("year_week")
    .all()
)

weeks = [w[0] for w in weekly_km]
kms = [w[1] for w in weekly_km]

plt.figure(figsize=(12, 5))
plt.plot(weeks, kms)
plt.xlabel("Week")
plt.ylabel("Distance (km)")
plt.title("Weekly runs volume")

plt.xticks(weeks[::4], rotation = 45)

plt.tight_layout()
plt.show()

