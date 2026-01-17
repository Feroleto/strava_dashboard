import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

def apply_standart_style(ax, title, ylabel, xlabel):
    ax.set_title(
        title, 
        fontsize=16, 
        fontweight="bold", 
        pad=20,
        loc="left",
        color="#2C3E50")
    
    ax.set_ylabel(
        ylabel,
        fontsize=12,
        color="#7F8C8D"
    )
    
    if xlabel:
        ax.set_xlabel(
            xlabel,
            fontsize=12,
            color="#7F8C8D"
        )
    
    ax.yaxis.grid(
        True,
        linestyle='--',
        alpha=0.7
    )
    
    for spine in ["top", "right"]: ax.spines[spine].set_visible(False)
    plt.xticks(rotation=45)
    
def format_pace(x, pos):
    if x is None or np.isnan(x):
        return ""
    
    minutes = int(x)
    seconds = int((x - minutes) * 60)
    return f"{minutes}:{seconds:02d}"

def setup_plot(figsize=(12, 6)):
    plt.style.use("seaborn-v0_8-muted")
    return plt.subplots(figsize=figsize)

def yaxis_pace_formatter(ax):
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(format_pace))
    ax.invert_yaxis()

def number_up_bars(ax, bars):
    for bar in bars:
        height = bar.get_height()
        if height > 0:
            ax.annotate(
                f"{height:.1f}",
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center", 
                va="bottom", 
                fontsize=9
            )

def plot_weekly_running_volume(df):
    fig, ax = setup_plot()
    
    weeks = df["label"]
    kms = df["total_km"]
    
    # bars graphic
    bars = ax.bar(
        weeks, 
        kms, 
        color="#1f77b4", 
        alpha=0.8, 
        edgecolor="navy",
        linewidth=0.5
    )
    
    ax.plot(
        weeks,
        kms,
        color="red",
        marker='o',
        markersize=4,
        linestyle="--",
        alpha=0.4
    )
    
    # style
    title = "Weekly runs volume"
    ylabel = "Distance (km)"
    apply_standart_style(ax, title, ylabel, None)
    
    number_up_bars(ax, bars)
            
    plt.tight_layout()
    plt.show()
    
def plot_weekly_average_pace(df):
    fig, ax = setup_plot()
    
    weeks = df["label"]
    pace = df["pace_min_km"]
    
    ax.plot(
        weeks,
        pace,
        color="darkgreen",
        marker='o',
        linewidth=2,
        zorder=3
        )
    
    yaxis_pace_formatter(ax)
    
    title = "Weekly average pace"
    ylabel = "Pace (min/km)"
    apply_standart_style(ax, title, ylabel, None)
    
    plt.tight_layout()
    plt.show()
    
def plot_weekly_pace_vs_distance(df):
    fig, ax = setup_plot()
    
    df_plot = df.dropna(subset=["pace_min_km"]).copy()
    
    # colors based on chronological order
    colors = range(len(df_plot))
    
    # dispersion graphic
    scatter = ax.scatter(
        df_plot["total_km"],
        df_plot["pace_min_km"],
        c=colors,
        cmap="viridis",
        s=100,
        alpha=0.7,
        edgecolors="white",
        linewidth=0.8,
        zorder=3
    )
    
    # evolution line
    dist = df_plot["total_km"]
    pace = df_plot["pace_min_km"]
    if len(df_plot) > 1:
        coef = np.polyfit(dist, pace, 1)
        trend = np.poly1d(coef)
        dist_range = np.linspace(dist.min(), dist.max(), 100)
        
        ax.plot(
            dist_range,
            trend(dist_range),
            color="#E74C3C",
            linestyle="--",
            linewidth=2,
            alpha=0.6,
            label="Trend",
            zorder=2
        )
        
    yaxis_pace_formatter(ax)
    
    title = "Pace vs Weekly Volume"
    ylabel = "Pace (min/km)"
    xlabel = "Weekly Volume (km)"
    apply_standart_style(ax, title, ylabel, xlabel)
    
    # color bar to indicate time evolution
    cbar = plt.colorbar(scatter)
    cbar.set_label("Time Evolution (Weeks)", color="#7F8C8D")
    cbar.outline.set_visible(False)
    
    ax.legend(frameon=False)
    plt.tight_layout()
    plt.show()
        
def plot_pace_distance_histogram(df):
    if df.empty:
        print("No pace histogram data found")
        return
    
    fig, ax = setup_plot()
    
    bars = ax.bar(
        df["label"],
        df["distance_km"],
        edgecolor="navy",
        linewidth=0.5
    )
    
    number_up_bars(ax, bars)
    
    title = "Pace distribution weighted by distance"
    ylabel = "Total distance (km)"
    xlabel = "Pace (min/km)"
    apply_standart_style(ax, title, ylabel, xlabel)
    
    plt.tight_layout()
    plt.show()