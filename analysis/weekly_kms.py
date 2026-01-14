from sqlalchemy import func
import matplotlib.pyplot as plt
import pandas as pd
import argparse

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.db import SessionLocal, Activity

parser = argparse.ArgumentParser(description="Weekly volume analysis")
parser.add_argument("--hide_zero", action="store_true", help="Hide weeks with 0 km")
parser.add_argument("--limit", type=int, default=None, help="Weeks limit")
args = parser.parse_args()

session = SessionLocal()

weekly_km = (
    session.query(
        func.date(Activity.start_date, "weekday 0", "-6 days").label("week_start"),
        func.sum(Activity.distance_km).label("total_km")
    )
    .filter(Activity.type == "Run")
    .group_by("week_start")
    .order_by("week_start")
    .all()
)

df = pd.DataFrame(weekly_km, columns = ["week_start", "total_km"])
df["week_start"] = pd.to_datetime(df["week_start"])

all_weeks = pd.date_range(start = df["week_start"].min(), end=df["week_start"].max(), freq="W-MON")
df = df.set_index("week_start").reindex(all_weeks, fill_value=0).reset_index()
df.columns = ["week_start", "total_km"]

'''
# use to hide 0 km's weeks
if "--hide_zero" in sys.argv:
    df = df[df["total_km"] > 0].copy()
'''

if args.hide_zero:
    df = df[df["total_km"] > 0].copy()
    
if args.limit:
    df = df.tail(args.limit).copy()

df["label"] = df["week_start"].dt.strftime("%d/%m/%y")

weeks = df["label"]
kms = df["total_km"]

plt.style.use('seaborn-v0_8-muted')
fig, ax = plt.subplots(figsize=(12,6))

bars = ax.bar(weeks, kms, color = "#1f77b4", alpha = 0.8, edgecolor = "navy", linewidth = 0.5)

ax.plot(weeks, kms, color = "red", marker = 'o', markersize = 4, linestyle = "--", alpha = 0.4)

ax.set_title("Weekly runs volume", fontsize = 16, fontweight = "bold", pad = 20)
#ax.set_xlabel("Year-Week", fontsize = 12)
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

