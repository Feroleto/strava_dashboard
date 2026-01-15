import argparse
import data_manager
import charts

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
    
    raw_data = data_manager.fetch_weekly_data()
    df = data_manager.process_raw_data(raw_data, hide_zero=args.hide_zero, limit=args.limit)
    
    if df.empty:
        print("None data found with this filters")
        return
    
    if args.type == "distance":
        charts.plot_weekly_running_volume(df)
    
    elif args.type == "pace":
        charts.plot_weekly_average_pace(df)
        
    elif args.type == "pace_vs_dist":
        charts.plot_weekly_pace_vs_distance(df)
        
if __name__ == "__main__":
    main()