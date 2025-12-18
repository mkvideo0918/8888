
import React, { memo } from 'react';

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

  const getInterpretation = (v: number) => {
    if (v < 25) return "市場處於極度恐慌，可能代表資產被嚴重低估，是潛在的買入機會。";
    if (v < 45) return "投資者情緒謹慎，市場情緒低迷，通常伴隨價格調整。";
    if (v < 55) return "市場情緒平衡，多空力量拉鋸，等待明確信號。";
    if (v < 75) return "投資者情緒樂觀，市場熱度增加，需注意追高風險。";
    return "市場極度亢奮，可能出現投機泡沫，需警惕市場見頂回落。";
  };

  const color = getColor(value);
  const interpretation = getInterpretation(value);
  const rotation = (value / 100) * 180 - 90; 

  return (
    <div className="p-6 glass-effect rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group will-change-transform">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex flex-col items-center mb-6 relative">
        <div className="relative group/title">
          <h3 className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] cursor-help">
            Market Sentiment Index
          </h3>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-900 border border-white/10 rounded-lg text-[10px] text-gray-300 opacity-0 group-hover/title:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl glass-effect text-center leading-relaxed">
            此數據顯示當前市場主導情緒：恐慌代表潛在機會，貪婪代表需謹慎。
          </div>
        </div>
        
        {currentPrice && (
          <div className="text-[10px] font-mono text-blue-400/80 font-bold mt-1 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20 animate-pulse">
            LIVE: {currentPrice}
          </div>
        )}
      </div>
      
      <div className="relative w-48 h-24 mb-4">
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
          <text x="8" y="48" className="fill-gray-600 text-[4px] font-bold">FEAR</text>
          <text x="82" y="48" className="fill-gray-600 text-[4px] font-bold">GREED</text>
        </svg>

        <div 
          className="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom -translate-x-1/2 transition-transform duration-1000 ease-out z-10 will-change-transform"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)`, borderRadius: '100% 100% 0 0' }}
        >
          <div className="w-3 h-3 bg-white rounded-full absolute -bottom-1.5 -left-1 shadow-lg border-2 border-[#0a0a0a]"></div>
        </div>
      </div>

      <div className="text-center relative group/value">
        <div className={`text-3xl font-black transition-colors duration-500 cursor-help ${isAnalyzing ? 'animate-pulse text-gray-500' : ''}`} style={{ color: isAnalyzing ? undefined : color }}>
          {isAnalyzing ? '--' : value}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">
          {isAnalyzing ? 'Analyzing...' : label}
        </div>
        
        {!isAnalyzing && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 bg-neutral-900 border border-white/10 rounded-xl text-[10px] text-gray-300 opacity-0 group-hover/value:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl glass-effect text-center leading-relaxed">
            <span className="block font-bold mb-1 text-white uppercase tracking-tighter">大師級判讀：</span>
            {interpretation}
          </div>
        )}
      </div>
      
      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

export default memo(FearGreedIndex);
