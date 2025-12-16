import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_data():
    np.random.seed(42)
    start_date = datetime(2023, 1, 1)
    dates = [start_date + timedelta(days=x) for x in range(365 * 2)] # 2 years of data
    
    # Base trend
    t = np.linspace(0, 10, len(dates))
    trend = 20 * t + 1000
    
    # Seasonality (weekly)
    seasonality = 100 * np.sin(2 * np.pi * np.array(range(len(dates))) / 7)
    
    # Noise
    noise = np.random.normal(0, 50, len(dates))
    
    sales = trend + seasonality + noise
    
    # Regional Data
    regions = ['North', 'South', 'East', 'West']
    data = []
    
    for i, date in enumerate(dates):
        daily_total = sales[i]
        # Distribute among regions
        r_sales = np.random.dirichlet(np.ones(4)) * daily_total
        for r, s in zip(regions, r_sales):
            data.append({
                'date': date.strftime('%Y-%m-%d'),
                'region': r,
                'sales': round(s, 2),
                'marketing_spend': round(np.random.uniform(50, 200), 2), # Feature
                'holiday': 1 if np.random.rand() > 0.95 else 0 # Feature
            })
            
    df = pd.DataFrame(data)
    df.to_csv('sales_data.csv', index=False)
    print("Data generated: sales_data.csv")

if __name__ == "__main__":
    generate_data()
