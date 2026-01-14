from sqlalchemy import func

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.db import SessionLocal
from database.db import Activity

session = SessionLocal()

stats = session.query(
    func.count(Activity.id),
    func.sum(Activity.distance_km),
    func.avg(Activity.distance_km),
    func.sum(Activity.moving_time_sec),
    func.max(Activity.distance_km),
    func.max(Activity.elevation_gain),
    func.avg(Activity.average_bpm)
).filter(Activity.distance_km > 0).one()

total_runs = stats[0]
total_km = stats[1]
avg_dist = stats[2]
total_time_sec = stats[3]
max_dist = stats[4]
max_elev = stats[5]
avg_bpm = stats[6]

if total_km and total_km > 0:
    avg_pace_raw = (total_time_sec / 60) / total_km
    
    minutes = int(avg_pace_raw)
    seconds = int(round((avg_pace_raw - minutes) * 60))
    if seconds == 60:
        minutes += 1
        seconds = 0
    pace_formated = f"{minutes:02d}:{seconds:02d}"
else:
    pace_formated = "00:00"

print(f"Number of Runs: {total_runs}")
print(f"Total of km's: {total_km:.2f}")
print(f"Average Distance: {avg_dist:.2f} km")
print(f"Average Pace: {pace_formated} min/km")
print(f"Max Distance: {max_dist:.2f} km")
print(f"Max Elevation: {max_elev:.0f} m")
print(f"Average Heartrate: {avg_bpm:.0f} bpm")

session.close()
