
import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';

const { HashRouter, Routes, Route, Link, useLocation } = ReactRouterDOM as any;

import { 
  LayoutDashboard, 
  Wallet, 
  History as HistoryIcon, 
  Settings as SettingsIcon, 
  Search, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  ShieldCheck,
  Target,
  Zap,
  Info
} from 'lucide-react';
import { AppState, Language, Currency, PortfolioItem, AnalysisHistory } from './types';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants';
import TradingViewWidget from './components/TradingViewWidget';
import FearGreedIndex from './components/FearGreedIndex';
import { analyzeMarket } from './services/geminiService';

const INITIAL_STATE: AppState = {
  language: 'zh-TW',
  currency: 'TWD',
  portfolio: JSON.parse(localStorage.getItem('portfolio') || '[]'),
  history: JSON.parse(localStorage.getItem('history') || '[]'),
  watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AAPL', 'NVDA', 'TSLA'],
};

// 使用 memo 化 Sidebar，防止儀表板數據更新時整個側邊欄重新渲染
const Sidebar = memo(({ language }: { language: Language }) => {
  const t = TRANSLATIONS[language];
  const location = useLocation();
  const menuItems = useMemo(() => [
    { name: t.dashboard, path: '/', icon: LayoutDashboard },
    { name: t.portfolio, path: '/portfolio', icon: Wallet },
    { name: t.history, path: '/history', icon: HistoryIcon },
    { name: t.settings, path: '/settings', icon: SettingsIcon },
  ], [t]);

  return (
    <div className="w-64 h-screen fixed left-0 top-0 glass-effect border-r border-white/10 p-6 flex flex-col z-50">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">WealthWise</h1>
      </div>
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                  : 'hover:bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={18} className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 glass-effect rounded-2xl text-[10px] text-gray-500 uppercase tracking-[0.2em] text-center border border-white/5">
        Master Insight Engine v2.0
      </div>
    </div>
  );
});

const Dashboard = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const [activeSymbol, setActiveSymbol] = useState(state.watchlist[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [sentiment, setSentiment] = useState({ score: 50, label: 'Neutral' });
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  
  const t = TRANSLATIONS[state.language];

  const fetchAllPrices = useCallback(async (watchlist: string[]) => {
    setIsPriceLoading(true);
    try {
      const results: Record<string, { price: number; change: number }> = {};
      await Promise.all(watchlist.map(async (symbol) => {
        if (symbol.endsWith('USDT')) {
          try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
            const data = await response.json();
            if (data.lastPrice) {
              results[symbol] = {
                price: parseFloat(data.lastPrice),
                change: parseFloat(data.priceChangePercent)
              };
            }
          } catch (e) { console.error(e); }
        } else {
          const basePrices: Record<string, number> = { 'AAPL': 180, 'NVDA': 700, 'TSLA': 190, 'MSFT': 400 };
          const base = basePrices[symbol] || 100;
          results[symbol] = {
            price: base + (Math.random() - 0.5) * 2,
            change: (Math.random() - 0.5) * 2
          };
        }
      }));
      setPrices(prev => ({ ...prev, ...results }));
    } finally {
      setIsPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPrices(state.watchlist);
    const interval = setInterval(() => fetchAllPrices(state.watchlist), 20000); 
    return () => clearInterval(interval);
  }, [state.watchlist, fetchAllPrices]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setCurrentAnalysis(null);
    try {
      const result = await analyzeMarket(activeSymbol, state.language);
      setCurrentAnalysis(result);
      if (result.sentimentScore !== undefined) {
        setSentiment({ score: result.sentimentScore, label: result.sentimentLabel || 'Neutral' });
      }
      const newHistory: AnalysisHistory = { id: Date.now().toString(), symbol: activeSymbol, timestamp: Date.now(), ...result };
      setState(prev => {
        const updated = [newHistory, ...prev.history].slice(0, 50);
        localStorage.setItem('history', JSON.stringify(updated));
        return { ...prev, history: updated };
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currencySymbol = CURRENCY_SYMBOLS[state.currency];
  const rate = EXCHANGE_RATES[state.currency];
  const activePriceData = prices[activeSymbol];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> 
                {activeSymbol}
              </h2>
              <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">{t.marketOverview}</span>
            </div>
            <div className="flex items-center gap-6">
              {activePriceData && (
                <div className={`flex flex-col items-end transition-opacity duration-300 ${isPriceLoading ? 'opacity-50' : 'opacity-100'}`}>
                   <div className="text-xl font-mono font-black">
                     {currencySymbol} {(activePriceData.price * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </div>
                   <div className={`text-[10px] font-bold flex items-center gap-1 ${activePriceData.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                     {activePriceData.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                     {activePriceData.change.toFixed(2)}%
                   </div>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text" 
                  placeholder={t.placeholderSymbol}
                  className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-48 transition-all focus:w-64 text-sm"
                  onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.toUpperCase();
                        if (val) {
                          if (!state.watchlist.includes(val)) {
                            setState(prev => ({ ...prev, watchlist: [...prev.watchlist, val] }));
                          }
                          setActiveSymbol(val);
                          (e.target as HTMLInputElement).value = '';
                          setSentiment({ score: 50, label: 'Neutral' });
                          setCurrentAnalysis(null);
                        }
                     }
                  }}
                />
              </div>
            </div>
          </div>
          <TradingViewWidget symbol={activeSymbol} />
        </div>

        <div className="space-y-6">
          <div className="space-y-2 relative group/fglabel">
            <div className="flex items-center gap-2 px-2">
              <h3 className="text-[10px] font-bold opacity-60 uppercase tracking-widest cursor-help">{t.fearGreed}</h3>
              <Info size={12} className="opacity-40" />
            </div>
            <div className="absolute bottom-full left-4 mb-2 w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl text-[11px] text-gray-300 opacity-0 group-hover/fglabel:opacity-100 pointer-events-none transition-opacity z-[60] shadow-2xl glass-effect leading-relaxed">
              <span className="block font-bold mb-1 text-white uppercase tracking-tighter">什麼是恐慌貪婪指數？</span>
              此指數透過分析市場波動、成交量量能及價格動向，將投資者的心理狀態量化為 0 到 100 之間的分數，用於判斷市場是否過熱或過冷。
            </div>
            <FearGreedIndex 
              value={sentiment.score} 
              label={sentiment.label} 
              isAnalyzing={isAnalyzing}
              currentPrice={activePriceData ? `${currencySymbol} ${(activePriceData.price * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : undefined}
            />
          </div>
          
          <div className="glass-effect rounded-2xl flex flex-col min-h-[500px] border border-white/10 relative overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-400" />
                <h3 className="text-sm font-bold tracking-wide uppercase">{t.aiAnalyst}</h3>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] text-gray-500 font-mono">LIVE_ENGINE</span>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col overflow-y-auto max-h-[400px] custom-scrollbar">
              {isAnalyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95">
                  <div className="relative">
                    <div className="w-16 h-16 border-2 border-blue-500/20 rounded-full"></div>
                    <div className="absolute top-0 w-16 h-16 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                    <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400 animate-pulse" size={24} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-200">{t.thinking}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Gemini Flash 3.0</p>
                  </div>
                </div>
              ) : currentAnalysis ? (
                <div className="space-y-6 animate-in slide-in-from-top-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-4 py-1 rounded-full text-[11px] font-black uppercase tracking-tighter ${
                        currentAnalysis.recommendation === 'Buy' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        currentAnalysis.recommendation === 'Sell' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                        'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}>
                        Decision: {currentAnalysis.recommendation}
                      </span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed text-blue-100">{currentAnalysis.summary}</p>
                  </div>

                  {currentAnalysis.keyLevels && (
                    <div className="grid grid-cols-2 gap-2">
                      {currentAnalysis.keyLevels.map((level: string, idx: number) => (
                        <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center gap-2">
                          <Target size={12} className="text-gray-500" />
                          <span className="text-[10px] font-mono text-gray-400">{level}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <div className="text-xs text-gray-400 whitespace-pre-wrap leading-loose italic font-serif">
                    {currentAnalysis.detailedAnalysis}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4 border border-white/5">
                    <HistoryIcon className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-sm font-medium">點擊「AI 深度分析」</p>
                </div>
              )}
            </div>

            <div className="p-6">
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl transition-all shadow-xl shadow-blue-900/40 border border-blue-400/20 active:scale-95"
              >
                {isAnalyzing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : t.analyze}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-effect rounded-3xl p-8 border border-white/5">
         <div className="flex items-center justify-between mb-6">
           <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest">{t.watchlist}</h3>
           <div className="h-px flex-1 mx-6 bg-white/5"></div>
         </div>
         <div className="flex flex-wrap gap-4">
            {state.watchlist.map(s => {
              const pData = prices[s];
              const isActive = activeSymbol === s;
              return (
                <button 
                  key={s} 
                  onClick={() => {
                    setActiveSymbol(s);
                    setSentiment({ score: 50, label: 'Neutral' });
                    setCurrentAnalysis(null);
                  }}
                  className={`px-5 py-4 rounded-2xl transition-all border flex flex-col gap-1 min-w-[140px] items-start relative group active:scale-95 ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30' : 'border-white/10 hover:border-white/30 bg-white/5 text-gray-400'}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-black text-sm uppercase tracking-tighter">{s}</span>
                    {pData && (
                      <span className={`text-[9px] font-bold ${pData.change >= 0 ? 'text-green-400 group-hover:text-green-300' : 'text-red-400 group-hover:text-red-300'} ${isActive ? 'text-white' : ''}`}>
                        {pData.change >= 0 ? '+' : ''}{pData.change.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {pData ? (
                    <div className={`text-xs font-mono font-bold ${isActive ? 'text-blue-100' : 'text-gray-200'}`}>
                      {currencySymbol} {(pData.price * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ) : (
                    <div className="h-4 w-12 bg-white/5 animate-pulse rounded"></div>
                  )}
                </button>
              );
            })}
         </div>
      </div>
    </div>
  );
});

const Portfolio = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const t = TRANSLATIONS[state.language];
  const symbol = CURRENCY_SYMBOLS[state.currency];
  const rate = EXCHANGE_RATES[state.currency];
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PortfolioItem>>({
    symbol: '', type: 'Stock', buyDate: new Date().toISOString().split('T')[0], cost: 0, quantity: 0
  });

  const fetchPortfolioPrices = useCallback(async () => {
    if (state.portfolio.length === 0) return;
    const results: Record<string, number> = {};
    const symbolsToFetch = Array.from(new Set(state.portfolio.map(item => item.symbol)));
    await Promise.all(symbolsToFetch.map(async (s) => {
      try {
        if (s.endsWith('USDT')) {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`);
          const data = await res.json();
          if (data.price) results[s] = parseFloat(data.price);
        } else {
          const basePrices: Record<string, number> = { 'AAPL': 180, 'NVDA': 700, 'TSLA': 190, 'MSFT': 400 };
          results[s] = (basePrices[s] || 100) + (Math.random() - 0.5) * 5;
        }
      } catch (e) { console.error(e); }
    }));
    setLivePrices(prev => ({ ...prev, ...results }));
  }, [state.portfolio]);

  useEffect(() => {
    fetchPortfolioPrices();
    const interval = setInterval(fetchPortfolioPrices, 20000);
    return () => clearInterval(interval);
  }, [fetchPortfolioPrices]);

  const handleAdd = () => {
    if (!newItem.symbol || !newItem.cost) return;
    const item: PortfolioItem = { ...newItem as PortfolioItem, id: Date.now().toString() };
    setState(prev => {
      const updated = [...prev.portfolio, item];
      localStorage.setItem('portfolio', JSON.stringify(updated));
      return { ...prev, portfolio: updated };
    });
    setIsAdding(false);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{t.portfolio}</h2>
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg active:scale-95">
          <Plus size={20} /> {t.addPortfolio}
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-effect p-8 rounded-3xl w-full max-w-md space-y-6 shadow-2xl border border-white/20 animate-in zoom-in-95">
            <h3 className="text-xl font-bold">{t.addPortfolio}</h3>
            <div className="space-y-4">
              <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="代碼" value={newItem.symbol} onChange={e => setNewItem({...newItem, symbol: e.target.value.toUpperCase()})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="成本" onChange={e => setNewItem({...newItem, cost: Number(e.target.value)})} />
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="數量" onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
              </div>
              <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.buyDate} onChange={e => setNewItem({...newItem, buyDate: e.target.value})} />
            </div>
            <div className="flex gap-4">
              <button onClick={handleAdd} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold active:scale-95">確認</button>
              <button onClick={() => setIsAdding(false)} className="flex-1 bg-white/10 py-3 rounded-xl font-bold active:scale-95">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-effect rounded-2xl overflow-hidden shadow-xl border border-white/5">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-widest opacity-60">
            <tr>
              <th className="px-6 py-4 font-bold">{t.symbol}</th>
              <th className="px-6 py-4 font-bold">{t.cost}</th>
              <th className="px-6 py-4 font-bold">{t.currentPrice}</th>
              <th className="px-6 py-4 font-bold">{t.profit}</th>
              <th className="px-6 py-4 font-bold">{t.plRatio}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {state.portfolio.map(item => {
              const currentPrice = livePrices[item.symbol] || item.cost;
              const profit = (currentPrice - item.cost) * item.quantity;
              const ratio = ((currentPrice - item.cost) / item.cost) * 100;
              const isProfit = profit >= 0;
              return (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-6"><div className="font-bold">{item.symbol}</div><div className="text-[10px] text-gray-500">{item.buyDate}</div></td>
                  <td className="px-6 py-6 font-mono text-sm text-gray-400">${item.cost.toLocaleString()}</td>
                  <td className="px-6 py-6 font-mono text-sm font-bold">{symbol} {(currentPrice * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={`px-6 py-6 font-mono text-sm font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>{isProfit ? '+' : ''} {symbol} {(profit * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-6"><span className={`px-3 py-1 rounded-full text-[10px] font-bold ${isProfit ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{ratio.toFixed(2)}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

const Settings = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const t = TRANSLATIONS[state.language];
  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold">{t.settings}</h2>
      <div className="glass-effect rounded-3xl p-8 space-y-8 border border-white/5">
        <div className="flex items-center justify-between">
          <div><h4 className="font-bold text-lg">{t.lang}</h4><p className="text-sm text-gray-500">選擇您的介面顯示語言</p></div>
          <select value={state.language} onChange={(e) => setState(prev => ({...prev, language: e.target.value as Language}))} className="bg-neutral-900 border border-white/10 rounded-xl p-3 outline-none">
            <option value="en">English</option><option value="zh-TW">繁體中文</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div><h4 className="font-bold text-lg">{t.currency}</h4><p className="text-sm text-gray-500">選擇顯示幣別</p></div>
          <select value={state.currency} onChange={(e) => setState(prev => ({...prev, currency: e.target.value as Currency}))} className="bg-neutral-900 border border-white/10 rounded-xl p-3 outline-none">
            <option value="USD">USD ($)</option><option value="TWD">TWD (NT$)</option><option value="MYR">MYR (RM)</option>
          </select>
        </div>
      </div>
    </div>
  );
});

const History = memo(({ state }: { state: AppState }) => {
  const t = TRANSLATIONS[state.language];
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold">{t.history}</h2>
      <div className="grid gap-6">
        {state.history.map(h => (
          <div key={h.id} className="glass-effect p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
            <div className="flex justify-between mb-2">
              <span className="text-xl font-bold">{h.symbol}</span>
              <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase ${h.recommendation === 'Buy' ? 'text-green-400 bg-green-500/10' : h.recommendation === 'Sell' ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                {h.recommendation}
              </span>
            </div>
            <p className="text-sm font-semibold mb-2">{h.summary}</p>
            <p className="text-xs text-gray-400 leading-relaxed italic">{h.detailedAnalysis}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

const App = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  
  // 使用 useMemo 防止無意義重繪
  const dashboardElement = useMemo(() => <Dashboard state={state} setState={setState} />, [state.watchlist, state.language, state.currency]);
  const portfolioElement = useMemo(() => <Portfolio state={state} setState={setState} />, [state.portfolio, state.language, state.currency]);
  const historyElement = useMemo(() => <History state={state} />, [state.history, state.language]);
  const settingsElement = useMemo(() => <Settings state={state} setState={setState} />, [state.language, state.currency]);

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex selection:bg-blue-500/30">
        <Sidebar language={state.language} />
        <main className="flex-1 ml-64 p-8 min-h-screen relative">
          <Routes>
            <Route path="/" element={dashboardElement} />
            <Route path="/portfolio" element={portfolioElement} />
            <Route path="/history" element={historyElement} />
            <Route path="/settings" element={settingsElement} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
