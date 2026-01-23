import argparse
from analysis.charts import (
    plot_weekly_running_volume,
    plot_weekly_average_pace,
    plot_weekly_pace_vs_distance,
    plot_pace_distance_histogram,
    plot_splits_pace_histogram,
    plot_z2_percentage,
    plot_z2_volume,
    plot_weekly_z2_stack
)
from analysis.processors import (
    process_pace_histogram_data,
    process_weekly_data,
    process_splits_pace_histogram,
    process_z2_percentage,
    process_z2_volume,
    merge_data
)
from analysis.formatters import (
    Z2_MIN,
    Z2_MAX
)
from database.queries import (
    fetch_individual_activity_data,
    fetch_weekly_data,
    fetch_split_pace,
    fetch_weekly_splits,
)
from processors.save_activities import save_activities_to_db
from processors.save_splits import ingest_splits


def handle_sync():
    save_activities_to_db()
    ingest_splits()
    
def handle_plots(args):
    if args.chart_type in ["distance", "pace", "pace_vs_dist"]:
        raw_data = fetch_weekly_data()
        df = process_weekly_data(raw_data, hide_zero=args.hide_zero, limit=args.limit)
    
        if df.empty:
            print("None data was found with this filters")
            return
        
        if args.chart_type == "distance":
            plot_weekly_running_volume(df)
        elif args.chart_type == "pace":
            plot_weekly_average_pace(df)
        elif args.chart_type == "pace_vs_dist":
            plot_weekly_pace_vs_distance(df)
            
    elif args.chart_type == "pace_histogram":
        raw_pace_data = fetch_individual_activity_data()
        df_hist = process_pace_histogram_data(raw_pace_data)
        plot_pace_distance_histogram(df_hist)
        
    elif args.chart_type == "splits_pace_histogram":
        raw_splits = fetch_split_pace()
        df_hist = process_splits_pace_histogram(raw_splits)
        plot_splits_pace_histogram(df_hist)
    
    elif args.chart_type in ["z2_percentage", "z2_volume", "z2_weeks"]:
        raw_weekly_splits = fetch_weekly_splits()
        
        if args.chart_type == "z2_percentage":
            df_z2 = process_z2_percentage(raw_weekly_splits, Z2_MIN, Z2_MAX)
            plot_z2_percentage(df_z2)
            
        elif args.chart_type == "z2_volume":
            df_z2 = process_z2_volume(raw_weekly_splits, Z2_MIN, Z2_MAX)
            plot_z2_volume(df_z2)
        
        elif args.chart_type == "z2_weeks":
            raw_weekly_total = fetch_weekly_data()
            df_weekly = process_weekly_data(raw_weekly_total)
            df_z2 = process_z2_volume(raw_weekly_splits, Z2_MIN, Z2_MAX)
            merged_df = merge_data(df_weekly, df_z2)
            plot_weekly_z2_stack(merged_df)
        
def main():
    parser = argparse.ArgumentParser(description="STRAVA Dashboard CLI - Performance Analysis")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to be executed")
    
    # sync subcommand
    subparsers.add_parser("sync", help="Search for new activities and splits in the STRAVA API")
    
    # plot subcommand
    plot_parser = subparsers.add_parser("plot", help="Show graphic visualization")
    plot_parser.add_argument(
        "chart_type",
        choices=[
            "distance", 
            "pace", 
            "pace_vs_dist", 
            "pace_histogram", 
            "splits_pace_histogram", 
            "z2_percentage", 
            "z2_volume",
            "z2_weeks"
            ],
        help="Graphic type"
    )
    
    plot_parser.add_argument("--hide_zero", action="store_true", help="hide weeks without runs")
    plot_parser.add_argument("--limit", type=int, default=None, help="Weeks limit")
    
    args = parser.parse_args()
    
    if args.command == "sync":
        handle_sync()
    elif args.command == "plot":
        handle_plots(args)
    else:
        parser.print_help()
    
if __name__ == "__main__":
    main()