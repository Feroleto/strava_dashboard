def extract_laps_from_activities(full_activity_data):
    laps = full_activity_data.get("laps", [])
    extracted_laps = []
    
    for lap in laps:
        extracted_laps.append({
            "name": lap.get("name"),
            "lap_index": lap.get("lap_index"),
            "start_index": lap.get("start_index"),
            "end_index": lap.get("end_index"),
            "distance": lap.get("distance"),
            "moving_time": lap.get("moving_time"),
            "avg_speed": lap.get("average_speed"),
            "pace": 1000 / lap.get("average_speed") if lap.get("average_speed") > 0 else 0
        })
        
    return extracted_laps

# filter laps with 5:00 or lower pace and distance > 100
def filter_speed_laps(all_activity_laps):
    splits = [l for l in all_activity_laps if l["pace"] < 300 and l["distance"] > 100]
    
    return splits