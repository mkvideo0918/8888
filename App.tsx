
import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
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
  Info,
  Send,
  User,
  Bot
} from 'lucide-react';
import { AppState, Language, Currency, PortfolioItem, AnalysisHistory } from './types';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants';
import TradingViewWidget from './components/TradingViewWidget';
import FearGreedIndex from './components/FearGreedIndex';
import { analyzeMarket, getChatResponse } from './services/geminiService';

const INITIAL_STATE: AppState = {
  language: 'zh-TW',
  currency: 'TWD',
  portfolio: JSON.parse(localStorage.getItem('portfolio') || '[]'),
  history: JSON.parse(localStorage.getItem('history') || '[]'),
  watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AAPL', 'NVDA', 'TSLA'],
};

const PriceDisplay = memo(({ price, currencySymbol, rate, change }: { price: number; currencySymbol: string; rate: number; change: number }) => {
  const prevPriceRef = useRef(price);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (price > prevPriceRef.current) setFlash('up');
    else if (price < prevPriceRef.current) setFlash('down');
    prevPriceRef.current = price;
    const timer = setTimeout(() => setFlash(null), 1000);
    return () => clearTimeout(timer);
  }, [price]);

  return (
    <div className={`flex flex-col items-end transition-colors duration-1000 ${
      flash === 'up' ? 'text-green-400' : flash === 'down' ? 'text-red-400' : ''
    }`}>
      <div className="text-xl font-mono font-black tracking-tighter">
        {currencySymbol} {(price * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-[10px] font-bold flex items-center gap-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {change.toFixed(2)}%
      </div>
    </div>
  );
});

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
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sentiment, setSentiment] = useState({ score: 50, label: 'Neutral' });
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[state.language];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchAllPrices = useCallback(async () => {
    try {
      const results: Record<string, { price: number; change: number }> = {};
      await Promise.all(state.watchlist.map(async (symbol) => {
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
          } catch (e) {}
        } else {
          const basePrices: Record<string, number> = { 'AAPL': 185.3, 'NVDA': 721.4, 'TSLA': 193.1, 'MSFT': 402.5 };
          const base = basePrices[symbol] || 100;
          const current = prices[symbol]?.price || base;
          const noise = (Math.random() - 0.5) * 0.05;
          results[symbol] = {
            price: current + noise,
            change: ((current + noise - base) / base) * 100
          };
        }
      }));
      setPrices(prev => ({ ...prev, ...results }));
    } catch (e) {}
  }, [state.watchlist, prices]);

  useEffect(() => {
    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 10000); 
    return () => clearInterval(interval);
  }, [fetchAllPrices]);

  const handleDeepAnalysis = async () => {
    setIsAnalyzing(true);
    setMessages([]);
    try {
      const result = await analyzeMarket(activeSymbol, state.language);
      if (result) {
        setSentiment({ score: result.sentimentScore, label: result.sentimentLabel });
        const initialMessage = `【大師診斷報告：${activeSymbol}】\n決策建議：${result.recommendation}\n關鍵水位：${result.keyLevels.join(', ')}\n\n${result.detailedAnalysis}`;
        setMessages([{ role: 'model', text: initialMessage }]);
        
        // 保存到歷史
        const newHistory: AnalysisHistory = { 
          id: Date.now().toString(), 
          symbol: activeSymbol, 
          timestamp: Date.now(), 
          ...result 
        };
        setState(prev => ({
          ...prev,
          history: [newHistory, ...prev.history].slice(0, 50)
        }));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isAnalyzing) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAnalyzing(true);

    const response = await getChatResponse(activeSymbol, messages, userMsg, state.language);
    setMessages(prev => [...prev, { role: 'model', text: response }]);
    setIsAnalyzing(false);
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
                <PriceDisplay 
                  price={activePriceData.price} 
                  currencySymbol={currencySymbol} 
                  rate={rate} 
                  change={activePriceData.change} 
                />
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
                          setMessages([]);
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
            <FearGreedIndex 
              value={sentiment.score} 
              label={sentiment.label} 
              isAnalyzing={isAnalyzing}
              currentPrice={activePriceData ? `${currencySymbol} ${(activePriceData.price * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : undefined}
            />
          </div>
          
          <div className="glass-effect rounded-2xl flex flex-col h-[500px] border border-white/10 relative overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold tracking-wide uppercase">{t.aiAnalyst}</h3>
              </div>
              <button 
                onClick={handleDeepAnalysis} 
                disabled={isAnalyzing}
                className="text-[10px] bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30 hover:bg-blue-600/40 transition-all font-bold"
              >
                {t.analyze}
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40 px-6">
                  <Bot size={48} className="mb-4 text-gray-500" />
                  <p className="text-sm font-medium">我是您的 AI 策略大師</p>
                  <p className="text-[11px] mt-2">點擊上方「分析」獲取報告，或直接在下方詢問關於 {activeSymbol} 的走勢建議。</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-none italic font-serif whitespace-pre-wrap'
                    }`}>
                      <div className="flex items-center gap-2 mb-1 opacity-60">
                        {m.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                        <span className="text-[9px] font-bold uppercase">{m.role === 'user' ? 'Investor' : 'Master Analyst'}</span>
                      </div>
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {isAnalyzing && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 rounded-bl-none flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white/[0.02] border-t border-white/10 flex gap-2">
              <input 
                type="text" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="詢問大師..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                disabled={isAnalyzing}
              />
              <button 
                type="submit"
                disabled={!inputValue.trim() || isAnalyzing}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white p-2 rounded-xl transition-all active:scale-95"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="glass-effect rounded-3xl p-8 border border-white/5">
         <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest mb-6">{t.watchlist}</h3>
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {state.watchlist.map(s => {
              const pData = prices[s];
              const isActive = activeSymbol === s;
              return (
                <button 
                  key={s} 
                  onClick={() => {
                    setActiveSymbol(s);
                    setSentiment({ score: 50, label: 'Neutral' });
                    setMessages([]);
                  }}
                  className={`px-5 py-4 rounded-2xl transition-all border flex flex-col gap-1 items-start group active:scale-95 ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-white/10 hover:border-white/30 bg-white/5 text-gray-400'}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-black text-sm">{s}</span>
                    {pData && (
                      <span className={`text-[9px] font-bold ${pData.change >= 0 ? 'text-green-400' : 'text-red-400'} ${isActive ? 'text-white' : ''}`}>
                        {pData.change >= 0 ? '+' : ''}{pData.change.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className={`text-xs font-mono font-bold ${isActive ? 'text-blue-100' : 'text-gray-200'}`}>
                    {pData ? `${currencySymbol} ${(pData.price * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '---'}
                  </div>
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
          const basePrices: Record<string, number> = { 'AAPL': 185.3, 'NVDA': 721.4, 'TSLA': 193.1, 'MSFT': 402.5 };
          results[s] = (basePrices[s] || 100) + (Math.random() - 0.5);
        }
      } catch (e) {}
    }));
    setLivePrices(prev => ({ ...prev, ...results }));
  }, [state.portfolio]);

  useEffect(() => {
    fetchPortfolioPrices();
    const interval = setInterval(fetchPortfolioPrices, 10000);
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
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg active:scale-95">
          <Plus size={20} /> {t.addPortfolio}
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-effect p-8 rounded-3xl w-full max-w-md space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold">{t.addPortfolio}</h3>
            <div className="space-y-4">
              <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" placeholder="代碼 (如 BTCUSDT)" value={newItem.symbol} onChange={e => setNewItem({...newItem, symbol: e.target.value.toUpperCase()})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" placeholder="成本" onChange={e => setNewItem({...newItem, cost: Number(e.target.value)})} />
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" placeholder="數量" onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
              </div>
              <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" value={newItem.buyDate} onChange={e => setNewItem({...newItem, buyDate: e.target.value})} />
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
          <tbody className="divide-y divide-white/5 text-sm">
            {state.portfolio.map(item => {
              const currentPrice = livePrices[item.symbol] || item.cost;
              const profit = (currentPrice - item.cost) * item.quantity;
              const ratio = ((currentPrice - item.cost) / (item.cost || 1)) * 100;
              const isProfit = profit >= 0;
              return (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-6 font-bold">{item.symbol}</td>
                  <td className="px-6 py-6 font-mono opacity-60">${item.cost.toLocaleString()}</td>
                  <td className="px-6 py-6 font-mono font-bold">{symbol} {(currentPrice * rate).toLocaleString()}</td>
                  <td className={`px-6 py-6 font-mono font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}{symbol} {(profit * rate).toLocaleString()}
                  </td>
                  <td className="px-6 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${isProfit ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {ratio.toFixed(2)}%
                    </span>
                  </td>
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
          <select value={state.language} onChange={(e) => setState(prev => ({...prev, language: e.target.value as Language}))} className="bg-neutral-900 border border-white/10 rounded-xl p-3 outline-none cursor-pointer">
            <option value="en">English</option><option value="zh-TW">繁體中文</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div><h4 className="font-bold text-lg">{t.currency}</h4><p className="text-sm text-gray-500">選擇顯示幣別</p></div>
          <select value={state.currency} onChange={(e) => setState(prev => ({...prev, currency: e.target.value as Currency}))} className="bg-neutral-900 border border-white/10 rounded-xl p-3 outline-none cursor-pointer">
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
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold">{h.symbol}</span>
              <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase ${h.recommendation === 'Buy' ? 'text-green-400 bg-green-500/10' : h.recommendation === 'Sell' ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                {h.recommendation}
              </span>
            </div>
            <p className="text-sm font-semibold mb-2">{h.summary}</p>
            <p className="text-xs text-gray-400 leading-relaxed italic border-l-2 border-blue-500/30 pl-4">{h.detailedAnalysis}</p>
          </div>
        ))}
        {state.history.length === 0 && <div className="text-center py-20 opacity-40 italic">無歷史紀錄</div>}
      </div>
    </div>
  );
});

const App = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const dashboardElement = useMemo(() => <Dashboard state={state} setState={setState} />, [state.watchlist, state.language, state.currency, state.history]);
  const portfolioElement = useMemo(() => <Portfolio state={state} setState={setState} />, [state.portfolio, state.language, state.currency]);
  const historyElement = useMemo(() => <History state={state} />, [state.history, state.language]);
  const settingsElement = useMemo(() => <Settings state={state} setState={setState} />, [state.language, state.currency]);

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex selection:bg-blue-500/30">
        <Sidebar language={state.language} />
        <main className="flex-1 ml-64 p-8 min-h-screen relative overflow-x-hidden">
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
