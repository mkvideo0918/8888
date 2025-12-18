
import React from 'react';

const FearGreedIndex: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const getColor = (v: number) => {
    if (v < 25) return 'text-red-500';
    if (v < 45) return 'text-orange-400';
    if (v < 55) return 'text-yellow-400';
    if (v < 75) return 'text-green-400';
    return 'text-green-600';
  };

  return (
    <div className="p-6 glass-effect rounded-2xl flex flex-col items-center justify-center">
      <h3 className="text-sm font-semibold opacity-60 mb-4 uppercase tracking-wider">Market Sentiment</h3>
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64" cy="64" r="58"
            fill="none" stroke="#222" strokeWidth="8"
          />
          <circle
            cx="64" cy="64" r="58"
            fill="none" stroke="currentColor" strokeWidth="8"
            strokeDasharray={`${(value / 100) * 364} 364`}
            className={getColor(value)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${getColor(value)}`}>{value}</span>
        </div>
      </div>
      <p className={`mt-4 font-bold ${getColor(value)}`}>{label}</p>
    </div>
  );
};

export default FearGreedIndex;
