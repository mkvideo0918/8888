
import React, { memo } from 'react';

interface Props {
  value: number;
  label: string;
  isAnalyzing?: boolean;
  currentPrice?: string;
  compact?: boolean;
}

const FearGreedIndex: React.FC<Props> = ({ value, label, isAnalyzing, currentPrice, compact }) => {
  const getColor = (v: number) => {
    if (v < 25) return '#ef4444'; // Extreme Fear
    if (v < 45) return '#f97316'; // Fear
    if (v < 55) return '#fbbf24'; // Neutral
    if (v < 75) return '#4ade80'; // Greed
    return '#16a34a'; // Extreme Greed
  };

  const getInterpretation = (v: number) => {
    if (v < 25) return "市場處於極度恐慌，可能代表資產被嚴重低估。";
    if (v < 45) return "投資者情緒謹慎，市場情緒低迷。";
    if (v < 55) return "市場情緒平衡，多空力量拉鋸。";
    if (v < 75) return "投資者情緒樂觀，市場熱度增加。";
    return "市場極度亢奮，可能出現投機泡沫。";
  };

  const color = getColor(value);
  const interpretation = getInterpretation(value);
  const rotation = (value / 100) * 180 - 90; 

  const gaugeSize = compact ? 'w-32 h-16' : 'w-48 h-24';
  const textSize = compact ? 'text-xl' : 'text-3xl';
  const labelSize = compact ? 'text-[8px]' : 'text-xs';

  return (
    <div className={`glass-effect rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group will-change-transform ${compact ? 'p-3' : 'p-6'}`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
      
      {!compact && currentPrice && (
        <div className="text-[10px] font-mono text-blue-400/80 font-bold mb-4 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20 animate-pulse">
          LIVE: {currentPrice}
        </div>
      )}
      
      <div className={`relative ${gaugeSize} mb-2`}>
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#1f2937"
            strokeWidth="8"
            strokeLinecap="round"
          />
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
        </svg>

        <div 
          className="absolute bottom-0 left-1/2 w-0.5 bg-white origin-bottom -translate-x-1/2 transition-transform duration-1000 ease-out z-10 will-change-transform"
          style={{ 
            height: compact ? '80%' : '90%',
            transform: `translateX(-50%) rotate(${rotation}deg)`, 
            borderRadius: '100% 100% 0 0' 
          }}
        >
          <div className="w-2 h-2 bg-white rounded-full absolute -bottom-1 -left-[3px] shadow-lg border border-[#0a0a0a]"></div>
        </div>
      </div>

      <div className="text-center relative group/value">
        <div className={`${textSize} font-black transition-colors duration-500 cursor-help ${isAnalyzing ? 'animate-pulse text-gray-500' : ''}`} style={{ color: isAnalyzing ? undefined : color }}>
          {isAnalyzing ? '--' : value}
        </div>
        <div className={`${labelSize} font-bold uppercase tracking-widest text-gray-500 mt-1`}>
          {isAnalyzing ? '...' : label}
        </div>
        
        {!isAnalyzing && !compact && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 bg-neutral-900 border border-white/10 rounded-xl text-[10px] text-gray-300 opacity-0 group-hover/value:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl glass-effect text-center leading-relaxed">
            <span className="block font-bold mb-1 text-white uppercase tracking-tighter">判讀指南：</span>
            {interpretation}
          </div>
        )}
      </div>
      
      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-5 h-5 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

export default memo(FearGreedIndex);
