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
    .filter(Activity.type == "Run")
    .group_by("year_week")
    .order_by("year_week")
    .all()
)

weeks = [w[0] for w in weekly_km]
kms = [w[1] for w in weekly_km]

plt.style.use('seaborn-v0_8-muted')
fig, ax = plt.subplots(figsize=(12,6))

bars = ax.bar(weeks, kms, color = "#1f77b4", alpha = 0.8, edgecolor = "navy", linewidth = 0.5)

ax.plot(weeks, kms, color = "red", marker = 'o', markersize = 4, linestyle = "--", alpha = 0.4)

ax.set_title("Weekly runs volume", fontsize = 16, fontweight = "bold", pad = 20)
ax.set_xlabel("Year-Week", fontsize = 12)
ax.set_ylabel("Distance (km)", fontsize = 12)

for bar in bars:
    height = bar.get_height()
    ax.annotate(f"{height:.1f}",
                xy = (bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha = "center", va = "bottom", fontsize = 9)
    
ax.yaxis.grid(True, linestyle = "--", alpha = 0.7)
ax.xaxis.grid(False)

plt.xticks(rotation = 45)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

plt.tight_layout()
plt.show()

session.close()

