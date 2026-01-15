import matplotlib.pyplot as plt
import argparse
import matplotlib.ticker as ticker

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from weekly_pace import fetch_weekly_pace_data, process_pace_data

def plot_pace_vs_volume(df):
    if df.empty:
        print("No data for pace vs volume")
        return
    
    df_plot = df.dropna(subset=["pace_min_km"]).copy()
    
    dist = df_plot["total_km"] # x
    pace = df_plot["pace_min_km"] # y
    
    plt.style.use("seaborn-v0_8-muted")
    fig, ax = plt.subplots(figsize=(8, 6))
    
    scatter = ax.scatter(
        dist,
        pace,
        alpha=0.7,
        s=60,
        edgecolors="black"
    )
    
    def format_pace_y(x, pos):
        minutes = int(x)
        seconds = int((x - minutes) * 60)
        return f"{minutes}:{seconds:02d}"
    
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(format_pace_y))
    
    ax.set_title("Pace vs Weekly Volume", fontsize=16, fontweight="bold", pad=20)
    ax.set_xlabel("Weekly volume (km)", fontsize=12)
    ax.set_ylabel("Pace (min/km)", fontsize=12)
    
    ax.invert_yaxis()
    
    ax.grid(True, linestyle="--", alpha=0.6)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    
    plt.tight_layout()
    plt.show()
    
def main():
    parser = argparse.ArgumentParser(description="Weekly pace analysis")
    parser.add_argument("--hide_zero", action="store_true", help="Hide weeks without runs")
    parser.add_argument("--limit", type=int, default=None, help="Weeks limitl")
    args = parser.parse_args()
    
    raw_pace_data = fetch_weekly_pace_data()
    df_processed_pace = process_pace_data(raw_pace_data, hide_zero=args.hide_zero, limit=args.limit)
    plot_pace_vs_volume(df_processed_pace)
    
if __name__ == "__main__":
    main()