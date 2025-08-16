import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TemplateTrendBucket } from '../../types/analytics';

interface TrendChartProps {
  data: TemplateTrendBucket[];
  channelTrend?: boolean; // future enhancement if we plot multi-channel stacked
  height?: number;
  className?: string;
}

// Format date label (bucketStart assumed YYYY-MM-DD)
function formatDateLabel(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00Z');
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}

const TrendChart: React.FC<TrendChartProps> = ({ data, height = 260, className }) => {
  // Guard: nothing to plot
  if (!data || data.length === 0) {
    return <div className={"text-xs text-gray-500 italic p-2 border rounded bg-white " + (className || '')}>No trend data</div>;
  }

  // Tooltip value type; recharts passes value as number | string; we restrict to number
  const tooltipFormatter = (value: number | string) => [`${value}`, 'Messages'] as [string, string];
  const labelFormatter = (label: string) => `Date: ${label}`;

  return (
    <div className={className} data-testid="trend-chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="bucketStart"
            tickFormatter={formatDateLabel}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            allowDecimals={false}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <Tooltip
            formatter={(value) => tooltipFormatter(value as number | string)}
            labelFormatter={labelFormatter}
            contentStyle={{ fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line
            type="monotone"
            dataKey="count"
            name="Messages"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
