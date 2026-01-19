import pandas as pd

def format_seconds(seconds):
    if pd.isna(seconds):
        return  "00:00:00"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    sec = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{sec:02d}"
    else:
        return f"{minutes:02d}:{sec:02d}"
    
def format_pace(pace_decimal):
    if pd.isna(pace_decimal) or pace_decimal == float("inf"):
        return "0:00"
    
    minutes = int(pace_decimal)
    seconds = int((pace_decimal - minutes) * 60)
    return f"{minutes}:{seconds:02d}"

PACE_ZONES = [
    (0, 4.0, "< 4:00"),
    (4.0, 4.5, "4:00-4:30"),
    (4.5, 5.0, "4:30-5:00"),
    (5.0, 5.5, "5:00-5:30"),
    (5.5, 6.0, "5:30-6:00"),
    (6.0, 6.5, "6:00-6:30"),
    (6.5, 7.0, "6:30-7:00"),
    (7.0, 20.0, "> 7:00"),
]

def format_pace_bin(interval):
        start = interval.left
        end = interval.right
        return f"{int(start)}:{int((start%1)*60):02d}-{int(end)}:{int((end%1)*60):02d}"