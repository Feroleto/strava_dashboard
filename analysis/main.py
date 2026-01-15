import argparse

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from weekly_pace import fetch_weekly_pace_data, process_pace_data, plot_weekly_pace
from weekly_kms import plot_running_volume
from pace_vs_volume import plot_pace_vs_volume

def main():
    parser = argparse.ArgumentParser(description="STRAVA Dashboard CLI - Performance Analysis")
    
    parser.add_argument(
        "type",
        choices=["distance", "pace", "pace_vs_dist"],
        help="Graphic type: weekly distance, weekly average pace or pace vs volume"
    )
    
    parser.add_argument("--hide_zero", action="store_true", help="hide weeks without runs")
    parser.add_argument("--limit", type=int, default=None, help="Weeks limit")
    
    args = parser.parse_args()
    
    print(f"-> Searching for data and creating analysis: {args.type.upper()}...")
    raw_data = fetch_weekly_pace_data()
    df = process_pace_data(raw_data, hide_zero=args.hide_zero, limit=args.limit)
    
    if df.empty:
        print("None data found with this filters")
        return
    
    if args.type == "distance":
        plot_running_volume(df)
        print("Show graphic for weekly running volume")
        
    elif args.type == "pace":
        plot_weekly_pace(df)
        
    elif args.type == "pace_vs_dist":
        plot_pace_vs_volume(df)
        
if __name__ == "__main__":
    main()