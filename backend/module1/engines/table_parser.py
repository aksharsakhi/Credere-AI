"""
Financial Table Parser
======================
Parses financial tables from PDFs and generates trend analysis data.
Automatically detects revenue/profit/debt trends across years.
"""

import re
import logging
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Dict, Any, Optional

from ..models.financial_data import (
    FinancialTable,
    TrendDataPoint,
    TrendAnalysis,
)
from ..utils.pdf_utils import parse_currency_value

logger = logging.getLogger(__name__)

# Metrics we try to detect in table headers
FINANCIAL_METRICS = {
    "revenue": ["revenue", "turnover", "sales", "total income", "income from operations"],
    "profit": ["profit", "net profit", "pat", "profit after tax", "net income"],
    "debt": ["debt", "borrowings", "total debt", "long term debt", "loans"],
    "assets": ["total assets", "assets"],
    "liabilities": ["total liabilities", "liabilities"],
    "cash_flow": ["cash flow", "operating cash flow", "cfo", "cash from operations"],
    "equity": ["equity", "net worth", "shareholders equity", "shareholders' equity"],
    "ebitda": ["ebitda", "operating profit"],
    "ebit": ["ebit", "earnings before interest"],
}


class TableParser:
    """
    Parses financial tables and produces:
    1. Structured FinancialTable objects
    2. TrendAnalysis objects with year-over-year growth rates
    """

    def parse_tables_for_trends(self, tables: List[FinancialTable]) -> List[TrendAnalysis]:
        """
        Analyze tables to extract financial trends.
        Looks for year-separated columns or rows with financial metrics.
        """
        all_trends: List[TrendAnalysis] = []

        for table in tables:
            if not table.rows:
                continue

            # Strategy 1: Year columns (e.g., headers = [Metric, 2022, 2023, 2024])
            year_cols = self._detect_year_columns(table.headers)
            if year_cols:
                trends = self._extract_trends_from_year_columns(table, year_cols)
                all_trends.extend(trends)
                continue

            # Strategy 2: Year in rows (e.g., rows have Year | Revenue | Profit)
            year_row_key = self._detect_year_row_key(table.headers)
            if year_row_key:
                trends = self._extract_trends_from_year_rows(table, year_row_key)
                all_trends.extend(trends)

        # Generate visual charts for each trend as base64 images
        for trend in all_trends:
            if len(trend.data_points) >= 2:
                try:
                    trend.chart_base64 = self._generate_plot(trend)
                except Exception as e:
                    logger.error(f"Failed to generate plot for {trend.metric_name}: {e}")

        return all_trends

    def _generate_plot(self, trend: TrendAnalysis) -> str:
        """Generate a sleek combined bar and line chart using Matplotlib and Seaborn."""
        years = [dp.year for dp in trend.data_points]
        values = [dp.value for dp in trend.data_points]

        # Use seaborn style
        sns.set_theme(style="whitegrid")
        
        # Create a visually pleasing dark/modern styled figure
        fig, ax1 = plt.subplots(figsize=(8, 4))
        fig.patch.set_facecolor('#1a2035')
        ax1.set_facecolor('#1a2035')

        # Colors
        bar_color = '#3b82f6'
        line_color = '#10b981'
        text_color = '#e2e8f0'

        # Bar plot
        bars = ax1.bar(years, values, color=bar_color, alpha=0.6, width=0.4, label='Value (Cr)')
        
        # Line plot overlaid
        ax1.plot(years, values, color=line_color, marker='o', linewidth=3, markersize=8, label='Trend')

        # Add data labels above bars
        for bar, val in zip(bars, values):
            height = bar.get_height()
            ax1.annotate(f'Rs. {val} Cr',
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 6),  # 3 points vertical offset
                        textcoords="offset points",
                        ha='center', va='bottom', color=text_color, fontweight='bold', fontsize=10)

        # Grid and axes styling
        ax1.grid(color='#334155', linestyle='--', linewidth=0.5, axis='y', alpha=0.5)
        ax1.spines['top'].set_visible(False)
        ax1.spines['right'].set_visible(False)
        ax1.spines['left'].set_color('#475569')
        ax1.spines['bottom'].set_color('#475569')
        
        ax1.tick_params(axis='x', colors=text_color, labelsize=11)
        ax1.tick_params(axis='y', colors=text_color, labelsize=10)
        
        ax1.set_ylabel(f'{trend.metric_name} (Rs. Cr)', color=text_color, fontsize=12, labelpad=10)
        ax1.set_title(f'{trend.metric_name} Trend Over Years', color=text_color, fontsize=14, fontweight='600', pad=15)

        # Save to base64
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png', facecolor=fig.get_facecolor(), edgecolor='none', dpi=120)
        plt.close(fig)
        
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        return f"data:image/png;base64,{img_base64}"

    def _detect_year_columns(self, headers: List[str]) -> List[str]:
        """Detect columns that represent years (e.g., '2022', '2023', 'FY2024')."""
        year_cols = []
        for h in headers:
            cleaned = re.sub(r'[^0-9]', '', h)
            if len(cleaned) == 4 and cleaned.startswith(('19', '20')):
                year_cols.append(h)
        return sorted(year_cols)

    def _detect_year_row_key(self, headers: List[str]) -> Optional[str]:
        """Detect if there's a 'Year' or 'Period' column in headers."""
        for h in headers:
            if any(kw in h.lower() for kw in ['year', 'period', 'fy', 'date']):
                return h
        return None

    def _extract_trends_from_year_columns(
        self, table: FinancialTable, year_cols: List[str]
    ) -> List[TrendAnalysis]:
        """Extract trends when years are column headers."""
        trends = []

        for row in table.rows:
            # Find what metric this row represents
            metric_name = None
            for header in table.headers:
                if header in year_cols:
                    continue
                val = row.get(header, "")
                if val and isinstance(val, str) and not re.match(r'^[\d.,\s₹$%-]+$', val):
                    metric_name = val.strip()
                    break

            if not metric_name:
                continue

            # Check if this is a recognized financial metric
            detected_category = self._categorize_metric(metric_name)

            data_points = []
            for year_col in year_cols:
                raw_val = row.get(year_col, "")
                parsed = parse_currency_value(str(raw_val)) if raw_val else None
                if parsed is not None:
                    year_clean = re.sub(r'[^0-9]', '', year_col)
                    data_points.append(TrendDataPoint(year=year_clean, value=parsed))

            if len(data_points) >= 2:
                # Compute growth rates
                for i in range(1, len(data_points)):
                    prev = data_points[i - 1].value
                    if prev and prev != 0:
                        data_points[i].growth_rate = round(
                            (data_points[i].value - prev) / abs(prev) * 100, 2
                        )

                # Average growth
                growth_rates = [dp.growth_rate for dp in data_points if dp.growth_rate is not None]
                avg_growth = round(sum(growth_rates) / len(growth_rates), 2) if growth_rates else None

                # Trend direction
                direction = "stable"
                if avg_growth is not None:
                    if avg_growth > 5:
                        direction = "increasing"
                    elif avg_growth < -5:
                        direction = "decreasing"

                trend = TrendAnalysis(
                    metric_name=detected_category or metric_name,
                    data_points=data_points,
                    average_growth=avg_growth,
                    trend_direction=direction,
                )
                trends.append(trend)

        return trends

    def _extract_trends_from_year_rows(
        self, table: FinancialTable, year_key: str
    ) -> List[TrendAnalysis]:
        """Extract trends when years are in rows (e.g., Year | Revenue | Profit)."""
        trends_dict: Dict[str, List[TrendDataPoint]] = {}

        # Get all non-year columns as metrics
        metric_cols = [h for h in table.headers if h != year_key]

        for row in table.rows:
            year_val = row.get(year_key, "")
            year_clean = re.sub(r'[^0-9]', '', str(year_val))
            if not year_clean or len(year_clean) != 4:
                continue

            for col in metric_cols:
                raw_val = row.get(col, "")
                parsed = parse_currency_value(str(raw_val)) if raw_val else None
                if parsed is not None:
                    if col not in trends_dict:
                        trends_dict[col] = []
                    trends_dict[col].append(TrendDataPoint(year=year_clean, value=parsed))

        trends = []
        for metric_name, data_points in trends_dict.items():
            if len(data_points) < 2:
                continue

            # Sort by year
            data_points.sort(key=lambda dp: dp.year)

            # Compute growth rates
            for i in range(1, len(data_points)):
                prev = data_points[i - 1].value
                if prev and prev != 0:
                    data_points[i].growth_rate = round(
                        (data_points[i].value - prev) / abs(prev) * 100, 2
                    )

            growth_rates = [dp.growth_rate for dp in data_points if dp.growth_rate is not None]
            avg_growth = round(sum(growth_rates) / len(growth_rates), 2) if growth_rates else None

            direction = "stable"
            if avg_growth is not None:
                if avg_growth > 5:
                    direction = "increasing"
                elif avg_growth < -5:
                    direction = "decreasing"

            detected_category = self._categorize_metric(metric_name)
            trends.append(TrendAnalysis(
                metric_name=detected_category or metric_name,
                data_points=data_points,
                average_growth=avg_growth,
                trend_direction=direction,
            ))

        return trends

    def _categorize_metric(self, name: str) -> Optional[str]:
        """Try to categorize a metric name into a standard financial category."""
        name_lower = name.lower().strip()
        for category, keywords in FINANCIAL_METRICS.items():
            for kw in keywords:
                if kw in name_lower:
                    return category.title()
        return None
