import pandas as pd
import numpy as np

class DataAnalyzer:
    def __init__(self, filepath):
        self.df = pd.read_csv(filepath) if filepath.endswith('.csv') else pd.read_excel(filepath)
        # Basic cleanup
        self.df = self.df.dropna(how='all')
    
    def get_summary(self):
        """Returns statistical summary of the dataset."""
        categorical_cols = self.df.select_dtypes(include=['object', 'category']).columns.tolist()
        categorical_values = {col: self.df[col].dropna().unique().tolist() for col in categorical_cols}
        
        summary = {
            'rows': len(self.df),
            'columns': len(self.df.columns),
            'col_names': list(self.df.columns),
            'missing_values': self.df.isnull().sum().to_dict(),
            'stats': self.df.describe(include=[np.number]).to_dict() if not self.df.select_dtypes(include=[np.number]).empty else {},
            'categorical_values': categorical_values
        }
        return summary

    def get_chart_data(self):
        """Generates data for Chart.js based on column types."""
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = self.df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        chart_data = []
        
        # 1. Histogram for first numeric column
        if numeric_cols:
            col = numeric_cols[0]
            counts, bins = np.histogram(self.df[col].dropna(), bins=10)
            chart_data.append({
                'type': 'bar',
                'title': f'Distribution of {col}',
                'labels': [f"{bins[i]:.2f}-{bins[i+1]:.2f}" for i in range(len(bins)-1)],
                'data': counts.tolist()
            })
            
        # 2. Bar chart for first categorical column
        if categorical_cols:
            col = categorical_cols[0]
            top_ten = self.df[col].value_counts().head(6)
            chart_data.append({
                'type': 'bar',
                'title': f'Top Categories in {col}',
                'labels': top_ten.index.tolist(),
                'data': top_ten.values.tolist()
            })
            
        # 3. Scatter plot for first two numeric columns
        if len(numeric_cols) >= 2:
            x, y = numeric_cols[0], numeric_cols[1]
            sample_df = self.df[[x, y]].dropna().sample(min(100, len(self.df)))
            scatter_points = [{'x': float(row[x]), 'y': float(row[y])} for _, row in sample_df.iterrows()]
            chart_data.append({
                'type': 'scatter',
                'title': f'{x} vs {y}',
                'data': scatter_points,
                'xLabel': x,
                'yLabel': y
            })

        # 4. Line chart for first numeric column trend
        if numeric_cols:
            col = numeric_cols[0]
            sample = self.df[col].dropna().head(50)
            chart_data.append({
                'type': 'line',
                'title': f'Trend of {col}',
                'labels': list(range(1, len(sample) + 1)),
                'data': [float(v) for v in sample.values]
            })
            
        return chart_data
