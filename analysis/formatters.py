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


def format_pace_bin(interval):
        start = interval.left
        end = interval.right
        return f"{int(start)}:{int((start%1)*60):02d}-{int(end)}:{int((end%1)*60):02d}"
    
Z2_MIN = 5.50
Z2_MAX = 9.00