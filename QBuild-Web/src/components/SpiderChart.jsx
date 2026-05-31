import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';

const SpiderChart = ({ data, title, height = 400, maxRating = 10, onDomainClick, rating = null, ratingLabel = 'Rating' }) => {
  // Transform data for Recharts format
  let chartData = data.map(item => ({
    name: item.name || item.label || item.domain || item.subDomain,
    value: item.rating || item.value || item.score || 0,
    fullMark: maxRating
  }));

  // Add rating as the first axis at the top if provided
  if (rating !== null) {
    chartData = [
      {
        name: `${ratingLabel}: ${rating}`,
        value: rating,
        fullMark: maxRating,
        isRatingAxis: true
      },
      ...chartData
    ];
  }

  // Determine color based on individual rating value
  const getRatingColor = (rating) => {
    if (rating >= 8) return '#22c55e'; // green (8 to 10)
    if (rating >= 6) return '#eab308'; // yellow (6 to 8)
    return '#ef4444'; // red (0 to 6)
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const color = getRatingColor(value);
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {payload[0].payload.name}
          </p>
          <p className="text-sm text-gray-600">
            Score: <span className="font-semibold" style={{ color }}>{value}/{maxRating}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom angle axis with clickable labels
  const CustomAngleAxis = ({ payload, x, y, ...props }) => {
    const handleClick = () => {
      if (onDomainClick && !payload.value.includes(':')) {
        onDomainClick(payload.value);
      }
    };

    // Check if this is the rating axis (first item when rating is provided)
    const isRatingAxis = payload.value.includes(':') && rating !== null;
    const ratingColor = isRatingAxis ? getRatingColor(rating) : '#374151';

    return (
      <g>
        {isRatingAxis ? (
          // Rating axis - prominent styling with background
          <g>
            <rect
              x={x - 50}
              y={y - 20}
              width={100}
              height={24}
              rx={12}
              fill={ratingColor}
              opacity={0.15}
            />
            <rect
              x={x - 46}
              y={y - 16}
              width={92}
              height={16}
              rx={8}
              fill={ratingColor}
              opacity={0.8}
            />
            <text
              x={x}
              y={y - 4}
              textAnchor="middle"
              fill="white"
              fontSize={10}
              fontWeight={700}
            >
              {payload.value}
            </text>
          </g>
        ) : (
          // Regular domain/subdomain label
          <text
            {...props}
            x={x}
            y={y}
            onClick={handleClick}
            style={{ cursor: onDomainClick ? 'pointer' : 'default', fontWeight: 500 }}
            fill="#374151"
            fontSize={11}
          >
            {payload.value}
          </text>
        )}
      </g>
    );
  };

  // Custom dot with color coding based on rating
  const CustomDot = (props) => {
    const { cx, cy, payload, index } = props;
    const color = getRatingColor(payload.value);
    const isRatingPoint = payload.isRatingAxis || index === 0 && rating !== null;

    return (
      <g>
        {isRatingPoint && (
          // Outer glow for rating point
          <circle
            cx={cx}
            cy={cy}
            r={12}
            fill={color}
            opacity={0.2}
          />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={isRatingPoint ? 8 : 5}
          fill={isRatingPoint ? color : color}
          stroke={isRatingPoint ? 'white' : color}
          strokeWidth={isRatingPoint ? 3 : 2}
          style={{ cursor: 'pointer' }}
        />
      </g>
    );
  };

  // Custom polygon with color-coded segments - connects ALL points
  const CustomPolygon = ({ points }) => {
    if (!points || points.length < 2) return null;

    const segments = [];
    for (let i = 0; i < points.length; i++) {
      const currentPoint = points[i];
      const nextPoint = points[(i + 1) % points.length];
      const color = getRatingColor(currentPoint.payload.value);

      segments.push(
        <line
          key={`segment-${i}`}
          x1={currentPoint.x}
          y1={currentPoint.y}
          x2={nextPoint.x}
          y2={nextPoint.y}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
        />
      );
    }

    return <g>{segments}</g>;
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid
            stroke="#9ca3af"
            strokeDasharray="3 3"
            radialLines={true}
            gridType="circle"
          />
          <PolarAngleAxis
            dataKey="name"
            tick={<CustomAngleAxis />}
            tickLine={{ stroke: '#9ca3af' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxRating]}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickCount={5}
            tickLine={{ stroke: '#9ca3af' }}
            axisLine={{ stroke: '#9ca3af' }}
          />
          <Radar
            name="Performance"
            dataKey="value"
            stroke="none"
            fill="none"
            shape={<CustomPolygon />}
            dot={<CustomDot />}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>

      {/* Color Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#ef4444]"></div>
          <span className="text-sm text-gray-600">0-6 (Red)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#eab308]"></div>
          <span className="text-sm text-gray-600">6-8 (Yellow)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#22c55e]"></div>
          <span className="text-sm text-gray-600">8-10 (Green)</span>
        </div>
      </div>

      {/* Clickable domain list below chart */}
      {onDomainClick && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Click on a domain to view sub-domains:</p>
          <div className="flex flex-wrap gap-2">
            {chartData
              .filter((item, index) => !(index === 0 && rating !== null)) // Exclude rating axis
              .map((item, index) => (
                <button
                  key={index}
                  onClick={() => onDomainClick(item.name)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  {item.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpiderChart;
