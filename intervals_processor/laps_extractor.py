def extract_recorded_laps(full_activity_data):
    laps = full_activity_data.get("laps", [])
    extracted_laps = []
    
    for i, lap in enumerate(laps):
        avg_speed = lap.get("average_speed", 0)
        avg_pace = 1000 / avg_speed if avg_speed > 0.3 else 0
        distance = lap.get("distance", 0)
        duration = lap.get("moving_time", 0)
        elev_gain = float(lap.get("total_elevation_gain", 0))

        grade = (elev_gain / distance * 100) if distance > 0 else 0
        vam = (elev_gain / duration * 3600) if duration > 0 else 0        
                    
        extracted_laps.append({
            "type": str(lap.get("name", f"LAP {i+1}")),
            "lap_index": lap.get("lap_index", i+1),
            "start_sec": lap.get("start_index", 0),
            "end_sec": lap.get("end_index", 0),
            "distance_m": round(float(distance), 1),
            "total_duration_sec": int(lap.get("elapsed_time", duration)),
            "moving_duration_sec": int(duration),
            "avg_pace": avg_pace,
            "avg_hr": round(float(lap.get("average_heartrate", 0)), 1),
            "elev_gain_m": round(elev_gain, 1),
            "avg_grade_percent": round(grade, 1),
            "vam": round(vam, 0)
        })
        
    return extracted_laps