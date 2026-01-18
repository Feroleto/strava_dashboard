import argparse
import charts

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from analysis.processors import process_pace_histogram_data, process_weekly_data, process_splits_pace_histogram, PACE_ZONES
from database.queries import fetch_individual_activity_data, fetch_weekly_data, fetch_split_pace

def main():
    parser = argparse.ArgumentParser(description="STRAVA Dashboard CLI - Performance Analysis")
    
    parser.add_argument(
        "type",
        choices=["distance", "pace", "pace_vs_dist", "pace_histogram", "splits_pace_histogram"],
        help="Graphic type: weekly distance, weekly average pace or pace vs volume"
    )
    
    parser.add_argument("--hide_zero", action="store_true", help="hide weeks without runs")
    parser.add_argument("--limit", type=int, default=None, help="Weeks limit")
    
    args = parser.parse_args()
    
    raw_data = fetch_weekly_data()
    df = process_weekly_data(raw_data, hide_zero=args.hide_zero, limit=args.limit)
    
    if df.empty:
        print("None data found with this filters")
        return
    
    if args.type == "distance":
        charts.plot_weekly_running_volume(df)
    
    elif args.type == "pace":
        charts.plot_weekly_average_pace(df)
        
    elif args.type == "pace_vs_dist":
        charts.plot_weekly_pace_vs_distance(df)
        
    elif args.type == "pace_histogram":
        raw_pace_data = fetch_individual_activity_data()
        df_hist = process_pace_histogram_data(raw_pace_data)
        charts.plot_pace_distance_histogram(df_hist)
        
    elif args.type == "splits_pace_histogram":
        raw_splits = fetch_split_pace()
        df_hist = process_splits_pace_histogram(raw_splits, PACE_ZONES)
        charts.plot_splits_pace_histogram(df_hist)
        print(df_hist["km"].sum())
        
        
if __name__ == "__main__":
    main()