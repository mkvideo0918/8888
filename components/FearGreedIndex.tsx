
import React from 'react';

interface Props {
  value: number;
  label: string;
  isAnalyzing?: boolean;
  currentPrice?: string;
}

const FearGreedIndex: React.FC<Props> = ({ value, label, isAnalyzing, currentPrice }) => {
  const getColor = (v: number) => {
    if (v < 25) return '#ef4444'; // Extreme Fear
    if (v < 45) return '#f97316'; // Fear
    if (v < 55) return '#fbbf24'; // Neutral
    if (v < 75) return '#4ade80'; // Greed
    return '#16a34a'; // Extreme Greed
  };

  const color = getColor(value);
  const rotation = (value / 100) * 180 - 90; // Map 0-100 to -90 to 90 degrees

  return (
    <div className="p-6 glass-effect rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex flex-col items-center mb-6">
        <h3 className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em]">Market Sentiment Index</h3>
        {currentPrice && (
          <div className="text-[10px] font-mono text-blue-400/80 font-bold mt-1 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20 animate-pulse">
            LIVE: {currentPrice}
          </div>
        )}
      </div>
      
      <div className="relative w-48 h-24 mb-4">
        {/* Gauge Background */}
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#1f2937"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active Progress */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="125.6"
            strokeDashoffset={125.6 - (value / 100) * 125.6}
            className="transition-all duration-1000 ease-out"
            style={{ opacity: isAnalyzing ? 0.3 : 1 }}
          />
          
          {/* Legend Markers */}
          <text x="8" y="48" className="fill-gray-600 text-[4px] font-bold">FEAR</text>
          <text x="82" y="48" className="fill-gray-600 text-[4px] font-bold">GREED</text>
        </svg>

        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom -translate-x-1/2 transition-transform duration-1000 ease-out z-10"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)`, borderRadius: '100% 100% 0 0' }}
        >
          <div className="w-3 h-3 bg-white rounded-full absolute -bottom-1.5 -left-1 shadow-lg border-2 border-[#0a0a0a]"></div>
        </div>
      </div>

      <div className="text-center">
        <div className={`text-3xl font-black transition-colors duration-500 ${isAnalyzing ? 'animate-pulse text-gray-500' : ''}`} style={{ color: isAnalyzing ? undefined : color }}>
          {isAnalyzing ? '--' : value}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">
          {isAnalyzing ? 'Analyzing...' : label}
        </div>
      </div>
      
      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

export default FearGreedIndex;
