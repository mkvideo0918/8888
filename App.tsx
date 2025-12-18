
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
  Bot,
  ExternalLink,
  Trash2,
  X,
  Clock,
  Gauge,
  RefreshCw,
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { AppState, Language, Currency, PortfolioItem, AnalysisHistory } from './types';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants';
import TradingViewWidget from './components/TradingViewWidget';
import FearGreedIndex from './components/FearGreedIndex';
import { analyzeMarket, getChatResponseStream, getFearGreedIndices } from './services/geminiService';

const STOCK_BASE_PRICES: Record<string, number> = {
  'AAPL': 231.54, 'NVDA': 140.22, 'TSLA': 467.24, 'MSFT': 420.12, 'GOOGL': 188.44, 'AMZN': 210.35, 'META': 585.10
};

const INITIAL_STATE: AppState = {
  language: 'zh-TW',
  currency: 'TWD',
  portfolio: JSON.parse(localStorage.getItem('portfolio') || '[]'),
  history: JSON.parse(localStorage.getItem('history') || '[]'),
  watchlist: JSON.parse(localStorage.getItem('watchlist') || '["BTCUSDT", "ETHUSDT", "SOLUSDT", "NVDA", "TSLA", "AAPL"]'),
};

const isUSMarketOpen = () => {
  const now = new Date();
  const estOffset = -5; 
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const estDate = new Date(utc + (3600000 * estOffset));
  const day = estDate.getDay();
  const hours = estDate.getHours();
  const minutes = estDate.getMinutes();
  const time = hours * 100 + minutes;
  const isWeekend = day === 0 || day === 6;
  const isOpenHours = time >= 930 && time <= 1600;
  return !isWeekend && isOpenHours;
};

const PriceDisplay = memo(({ price, currencySymbol, rate, change, isMarketClosed, language }: { price: number; currencySymbol: string; rate: number; change: number; isMarketClosed?: boolean, language: Language }) => {
  const prevPriceRef = useRef(price);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (isMarketClosed) { setFlash(null); return; }
    if (price > prevPriceRef.current) setFlash('up');
    else if (price < prevPriceRef.current) setFlash('down');
    prevPriceRef.current = price;
    const timer = setTimeout(() => setFlash(null), 1000);
    return () => clearTimeout(timer);
  }, [price, isMarketClosed]);

  return (
    <div className={`flex flex-col items-end transition-colors duration-1000 ${flash === 'up' ? 'text-green-400' : flash === 'down' ? 'text-red-400' : ''}`}>
      <div className="text-xl font-mono font-black tracking-tighter flex items-center gap-2">
        {isMarketClosed && <Clock size={10} className="text-gray-500/50" />}
        {currencySymbol} {(price * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-[10px] font-bold flex items-center gap-1 ${isMarketClosed ? 'text-gray-500/70' : (change >= 0 ? 'text-green-400' : 'text-red-400')}`}>
        {isMarketClosed ? t.prevClose : (change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
        {isMarketClosed ? '' : `${Math.abs(change).toFixed(2)}%`}
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
            <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}>
              <Icon size={18} className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 glass-effect rounded-2xl text-[10px] text-gray-500 uppercase tracking-[0.2em] text-center border border-white/5">Master Engine v3.3 Stable</div>
    </div>
  );
});

const Dashboard = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const [activeSymbol, setActiveSymbol] = useState(state.watchlist[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFetchingFNG, setIsFetchingFNG] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [marketOpen, setMarketOpen] = useState(isUSMarketOpen());
  
  const [stockSentiment, setStockSentiment] = useState<{score: number, label: string} | null>(() => {
    const cached = localStorage.getItem('cache_fng_stock');
    return cached ? JSON.parse(cached) : null;
  });
  const [cryptoSentiment, setCryptoSentiment] = useState<{score: number, label: string} | null>(() => {
    const cached = localStorage.getItem('cache_fng_crypto');
    return cached ? JSON.parse(cached) : null;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[state.language];

  useEffect(() => { 
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, isAnalyzing]);

  const fetchFearGreedData = useCallback(async () => {
    if (isFetchingFNG) return;
    setIsFetchingFNG(true);
    try {
      const results = await getFearGreedIndices(state.language);
      if (results) {
        setStockSentiment(results.stock);
        setCryptoSentiment(results.crypto);
        localStorage.setItem('cache_fng_stock', JSON.stringify(results.stock));
        localStorage.setItem('cache_fng_crypto', JSON.stringify(results.crypto));
      }
    } catch (e) {
      console.warn("F&G Error", e);
    } finally {
      setIsFetchingFNG(false);
    }
  }, [state.language]);

  useEffect(() => {
    fetchFearGreedData();
    const interval = setInterval(fetchFearGreedData, 3600000); 
    return () => clearInterval(interval);
  }, []);

  const fetchAllPrices = useCallback(async () => {
    const isCurrentlyOpen = isUSMarketOpen();
    setMarketOpen(isCurrentlyOpen);
    try {
      const results: Record<string, { price: number; change: number }> = {};
      await Promise.all(state.watchlist.map(async (symbol) => {
        const isCrypto = /USDT$|USDC$|BUSD$|BTC$|ETH$/.test(symbol);
        if (isCrypto) {
          const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
          const data = await response.json();
          if (data.lastPrice) results[symbol] = { price: parseFloat(data.lastPrice), change: parseFloat(data.priceChangePercent) };
        } else {
          const base = STOCK_BASE_PRICES[symbol] || 150.0;
          const prev = prices[symbol];
          if (!isCurrentlyOpen) results[symbol] = { price: base, change: 0 };
          else {
            const currentPrice = prev ? prev.price : base;
            const fluctuation = (Math.random() - 0.5) * (currentPrice * 0.0003); 
            const newPrice = currentPrice + fluctuation;
            results[symbol] = { price: newPrice, change: ((newPrice - base) / base) * 100 };
          }
        }
      }));
      setPrices(prev => ({ ...prev, ...results }));
    } catch (e) {}
  }, [state.watchlist, prices]);

  useEffect(() => {
    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 5000); 
    return () => clearInterval(interval);
  }, [fetchAllPrices]);

  const handleDeepAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    const loadingMsg = state.language === 'zh-TW' ? "正在調用大師智庫進行深度市場分析..." : "Analyzing market with Master AI...";
    setMessages([{ role: 'model', text: loadingMsg }]); 
    try {
      const result = await analyzeMarket(activeSymbol, state.language);
      if (result) {
        const report = `【深度大師報告：${activeSymbol}】\n決策建議：${result.recommendation}\n市場評價：${result.summary}\n支撐壓力：${result.keyLevels.join(' | ')}\n\n詳細見解：\n${result.detailedAnalysis}`;
        setMessages([{ role: 'model', text: report }]);
        setState(prev => ({ ...prev, history: [{ id: Date.now().toString(), symbol: activeSymbol, timestamp: Date.now(), ...result }, ...prev.history].slice(0, 50) }));
      } else {
        setMessages([{ role: 'model', text: "連線異常，大師目前無法接收信號。" }]);
      }
    } catch(e) {
      setMessages([{ role: 'model', text: "分析失敗，可能是 API 次數限制或代碼無效。" }]);
    } finally { setIsAnalyzing(false); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isAnalyzing) return;
    const userMsg = inputValue.trim();
    setInputValue('');
    
    // 取出之前的有效對話歷史
    const history = [...messages];
    
    // 即時在 UI 加入 user 訊息與空的 model 訊息
    setMessages(prev => [
      ...prev, 
      { role: 'user', text: userMsg },
      { role: 'model', text: "" } 
    ]);
    
    setIsAnalyzing(true);
    try {
      await getChatResponseStream(activeSymbol, history, userMsg, state.language, (streamedText) => {
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1].text = streamedText;
          }
          return updated;
        });
      });
    } catch (error) {
      console.error("Stream Fatal Error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderAnalyst = (isFull = false) => (
    <div className={`glass-effect rounded-2xl flex flex-col border border-white/10 relative overflow-hidden shadow-2xl transition-all duration-300 ${isFull ? 'fixed inset-4 md:inset-10 z-[100] bg-[#0c0c0c]' : 'h-[450px]'}`}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
            <Bot size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wide uppercase">{t.aiAnalyst}</h3>
            <span className="text-[8px] text-blue-500 font-mono tracking-widest uppercase animate-pulse">Master Engine v3.3 Stable</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all">
             {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
           </button>
           {!isFull && (
             <button onClick={handleDeepAnalysis} disabled={isAnalyzing} className="text-[10px] bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-all font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
               {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} {t.analyze}
             </button>
           )}
        </div>
      </div>
      
      <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-5 bg-[#0e0e0e]/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
            <Bot size={56} className="mb-4 text-gray-400" />
            <p className="text-base font-bold text-white">大師智庫已連線</p>
            <p className="text-[11px] mt-2 leading-relaxed px-10">
              您可以詢問有關市場的任何問題，例如：「${activeSymbol} 現在的支撐位在哪？」<br/>或是點擊「AI 深度分析」產生完整投資報告。
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[88%] rounded-2xl px-5 py-4 text-[13px] leading-relaxed shadow-xl ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-none font-medium'}`}>
                <div className="flex items-center gap-2 mb-2 opacity-50 text-[9px] font-black tracking-widest uppercase border-b border-white/5 pb-1">
                  {m.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                  <span>{m.role === 'user' ? 'Investor' : 'AI MASTER'}</span>
                </div>
                <div className="whitespace-pre-wrap font-sans">{m.text || (isAnalyzing && i === messages.length - 1 ? "正在連線智庫核心..." : "")}</div>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      
      <form onSubmit={handleSendMessage} className="p-4 bg-white/[0.03] border-t border-white/10 flex gap-3">
        <input 
          type="text" 
          value={inputValue} 
          onChange={e => setInputValue(e.target.value)} 
          placeholder="在此詢問大師市場見解..." 
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-600" 
          disabled={isAnalyzing} 
        />
        <button 
          type="submit" 
          disabled={!inputValue.trim() || isAnalyzing} 
          className="bg-blue-600 text-white px-5 rounded-2xl transition-all active:scale-95 hover:bg-blue-700 shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5 relative group">
            <div className="absolute -top-3 left-4 bg-blue-600 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded border border-blue-400 shadow-xl z-10 flex items-center gap-1">
              <ExternalLink size={8} /> TradingView Connection
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{activeSymbol}</h2>
                {!/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(activeSymbol) && !marketOpen && <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1 font-bold"><Clock size={10} /> {t.marketClosed}</span>}
              </div>
              <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">{t.marketOverview}</span>
            </div>
            <div className="flex items-center gap-6">
              {prices[activeSymbol] && <PriceDisplay price={prices[activeSymbol].price} currencySymbol={CURRENCY_SYMBOLS[state.currency]} rate={EXCHANGE_RATES[state.currency]} change={prices[activeSymbol].change} isMarketClosed={!/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(activeSymbol) && !marketOpen} language={state.language} />}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input type="text" placeholder={t.placeholderSymbol} className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-48 transition-all focus:w-64 text-sm uppercase font-mono"
                  onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.toUpperCase();
                        if (val) {
                          if (!state.watchlist.includes(val)) setState(prev => { const updated = [...prev.watchlist, val]; localStorage.setItem('watchlist', JSON.stringify(updated)); return { ...prev, watchlist: updated }; });
                          setActiveSymbol(val); setMessages([]);
                        }
                     }
                  }} />
              </div>
            </div>
          </div>
          <TradingViewWidget symbol={activeSymbol} />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 relative group">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[9px] font-bold opacity-60 uppercase tracking-tighter">US Stocks F&G</h3>
                <button onClick={() => fetchFearGreedData()} disabled={isFetchingFNG} className={`p-1 hover:bg-white/10 rounded transition-colors ${isFetchingFNG ? 'animate-spin' : ''}`}><RefreshCw size={10} className="opacity-40" /></button>
              </div>
              <FearGreedIndex value={stockSentiment?.score ?? 50} label={isFetchingFNG ? 'Updating...' : (stockSentiment?.label ?? 'Neutral')} isAnalyzing={isFetchingFNG} compact />
            </div>
            <div className="space-y-2 relative group">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[9px] font-bold opacity-60 uppercase tracking-tighter">Crypto F&G</h3>
                <button onClick={() => fetchFearGreedData()} disabled={isFetchingFNG} className={`p-1 hover:bg-white/10 rounded transition-colors ${isFetchingFNG ? 'animate-spin' : ''}`}><RefreshCw size={10} className="opacity-40" /></button>
              </div>
              <FearGreedIndex value={cryptoSentiment?.score ?? 50} label={isFetchingFNG ? 'Updating...' : (cryptoSentiment?.label ?? 'Neutral')} isAnalyzing={isFetchingFNG} compact />
            </div>
          </div>
          
          {renderAnalyst(false)}
        </div>
      </div>

      {isMaximized && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl animate-in fade-in duration-500 flex items-center justify-center">
           <div className="w-full max-w-5xl px-4 h-[90vh]">
             {renderAnalyst(true)}
           </div>
           <div className="fixed top-6 right-6 z-[120]">
             <button onClick={() => setIsMaximized(false)} className="p-4 bg-white/10 hover:bg-red-500 text-white rounded-full transition-all shadow-2xl active:scale-90 border border-white/10">
               <X size={28} />
             </button>
           </div>
        </div>
      )}

      <div className="glass-effect rounded-3xl p-8 border border-white/5">
         <div className="flex items-center justify-between mb-6">
           <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest">{t.watchlist}</h3>
           <span className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">Live Asset Watchlist</span>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {state.watchlist.map(s => {
              const pData = prices[s]; const isActive = activeSymbol === s; const isCrypto = /USDT$|USDC$|BUSD$|BTC$|ETH$/.test(s); const isClosed = !isCrypto && !marketOpen;
              return (
                <button key={s} onClick={() => { setActiveSymbol(s); setMessages([]); }} className={`px-5 py-4 rounded-2xl transition-all border flex flex-col gap-1 items-start group relative active:scale-95 ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-white/10 hover:border-white/30 bg-white/5 text-gray-400'}`}>
                  <div onClick={(e) => { e.stopPropagation(); setState(prev => { const updated = prev.watchlist.filter(w => w !== s); localStorage.setItem('watchlist', JSON.stringify(updated)); return { ...prev, watchlist: updated }; }); }} className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}><X size={12} /></div>
                  <div className="flex items-center justify-between w-full"><span className="font-black text-sm uppercase">{s}</span>{pData && (<span className={`text-[9px] font-bold ${isClosed ? 'text-gray-500' : (pData.change >= 0 ? 'text-green-400' : 'text-red-400')} ${isActive ? 'text-white' : ''}`}>{isClosed ? '---' : `${pData.change >= 0 ? '+' : ''}${pData.change.toFixed(1)}%`}</span>)}</div>
                  <div className={`text-xs font-mono font-bold ${isActive ? 'text-blue-100' : 'text-gray-200'}`}>{pData ? `${CURRENCY_SYMBOLS[state.currency]} ${(pData.price * EXCHANGE_RATES[state.currency]).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '---'}</div>
                  {isClosed && <span className="text-[7px] opacity-60 uppercase mt-1 bg-white/10 px-1 rounded flex items-center gap-1"><Clock size={8} /> {t.prevClose}</span>}
                </button>
              );
            })}
         </div>
      </div>
    </div>
  );
});

const Portfolio = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const t = TRANSLATIONS[state.language]; const symbol = CURRENCY_SYMBOLS[state.currency]; const rate = EXCHANGE_RATES[state.currency];
  const [livePrices, setLivePrices] = useState<Record<string, number>>({}); const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PortfolioItem>>({ symbol: '', type: 'Stock', buyDate: new Date().toISOString().split('T')[0], cost: 0, quantity: 0 });
  const [marketOpen, setMarketOpen] = useState(isUSMarketOpen());

  const fetchPortfolioPrices = useCallback(async () => {
    if (state.portfolio.length === 0) return; setMarketOpen(isUSMarketOpen());
    const results: Record<string, number> = {}; const symbolsToFetch = Array.from(new Set(state.portfolio.map(item => item.symbol)));
    await Promise.all(symbolsToFetch.map(async (s) => {
      try {
        if (/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(s)) { const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`); const data = await res.json(); if (data.price) results[s] = parseFloat(data.price); }
        else { const base = STOCK_BASE_PRICES[s] || 150.0; results[s] = isUSMarketOpen() ? base + (Math.random() - 0.5) : base; }
      } catch (e) {}
    }));
    setLivePrices(prev => ({ ...prev, ...results }));
  }, [state.portfolio]);

  useEffect(() => { fetchPortfolioPrices(); const interval = setInterval(fetchPortfolioPrices, 10000); return () => clearInterval(interval); }, [fetchPortfolioPrices]);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center"><h2 className="text-3xl font-bold">{t.portfolio}</h2><button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg active:scale-95"><Plus size={20} /> {t.addPortfolio}</button></div>
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-effect p-8 rounded-3xl w-full max-w-md space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold">{t.addPortfolio}</h3>
            <div className="space-y-4">
              <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none uppercase font-mono" placeholder="代碼 (如 BTCUSDT, NVDA)" value={newItem.symbol} onChange={e => setNewItem({...newItem, symbol: e.target.value.toUpperCase()})} />
              <div className="grid grid-cols-2 gap-4"><input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" placeholder="成本" onChange={e => setNewItem({...newItem, cost: Number(e.target.value)})} /><input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" placeholder="數量" onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} /></div>
              <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" value={newItem.buyDate} onChange={e => setNewItem({...newItem, buyDate: e.target.value})} />
            </div>
            <div className="flex gap-4"><button onClick={() => { if (!newItem.symbol || !newItem.cost) return; setState(prev => { const updated = [...prev.portfolio, { ...newItem as PortfolioItem, id: Date.now().toString() }]; localStorage.setItem('portfolio', JSON.stringify(updated)); return { ...prev, portfolio: updated }; }); setIsAdding(false); }} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold active:scale-95">確認</button><button onClick={() => setIsAdding(false)} className="flex-1 bg-white/10 py-3 rounded-xl font-bold active:scale-95">取消</button></div>
          </div>
        </div>
      )}
      <div className="glass-effect rounded-2xl overflow-hidden shadow-xl border border-white/5">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-widest opacity-60"><tr><th className="px-6 py-4 font-bold">{t.symbol}</th><th className="px-6 py-4 font-bold">{t.cost}</th><th className="px-6 py-4 font-bold">{t.currentPrice}</th><th className="px-6 py-4 font-bold">{t.profit}</th><th className="px-6 py-4 font-bold">{t.plRatio}</th><th className="px-6 py-4 font-bold">{t.actions}</th></tr></thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {state.portfolio.map(item => {
              const currentPrice = livePrices[item.symbol] || item.cost; const profit = (currentPrice - item.cost) * item.quantity; const ratio = ((currentPrice - item.cost) / (item.cost || 1)) * 100; const isProfit = profit >= 0; const isClosed = !(/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(item.symbol)) && !marketOpen;
              return (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-6 font-bold flex flex-col">{item.symbol}{isClosed && <span className="text-[8px] text-red-400 font-bold uppercase mt-1 flex items-center gap-1"><Clock size={8} /> {t.marketClosed}</span>}</td>
                  <td className="px-6 py-6 font-mono opacity-60">${item.cost.toLocaleString()}</td>
                  <td className="px-6 py-6 font-mono font-bold"><div className="flex flex-col"><span>{symbol} {(currentPrice * rate).toLocaleString()}</span>{isClosed && <span className="text-[8px] text-gray-500 font-normal">{t.prevClose}</span>}</div></td>
                  <td className={`px-6 py-6 font-mono font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>{isProfit ? '+' : ''}{symbol} {(profit * rate).toLocaleString()}</td>
                  <td className="px-6 py-6"><span className={`px-3 py-1 rounded-full text-[10px] font-bold ${isProfit ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{ratio.toFixed(2)}%</span></td>
                  <td className="px-6 py-6"><button onClick={() => setState(prev => { const updated = prev.portfolio.filter(p => p.id !== item.id); localStorage.setItem('portfolio', JSON.stringify(updated)); return { ...prev, portfolio: updated }; })} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={18} /></button></td>
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
        <div className="flex items-center justify-between"><div><h4 className="font-bold text-lg">{t.lang}</h4><p className="text-sm text-gray-500">選擇您的介面顯示語言</p></div><select value={state.language} onChange={(e) => setState(prev => ({...prev, language: e.target.value as Language}))} className="bg-neutral-900 border border-white/10 rounded-xl p-3 outline-none cursor-pointer"><option value="en">English</option><option value="zh-TW">繁體中文</option></select></div>
        <div className="flex items-center justify-between"><div><h4 className="font-bold text-lg">{t.currency}</h4><p className="text-sm text-gray-500">選擇顯示幣別</p></div><select value={state.currency} onChange={(e) => setState(prev => ({...prev, currency: e.target.value as Currency}))} className="bg-neutral-900 border border-white/10 rounded-xl p-3 outline-none cursor-pointer"><option value="USD">USD ($)</option><option value="TWD">TWD (NT$)</option><option value="MYR">MYR (RM)</option></select></div>
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
            <div className="flex justify-between items-center mb-4"><span className="text-xl font-bold">{h.symbol}</span><span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase ${h.recommendation === 'Buy' ? 'text-green-400 bg-green-500/10' : h.recommendation === 'Sell' ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>{h.recommendation}</span></div>
            <p className="text-sm font-semibold mb-2">{h.summary}</p><p className="text-xs text-gray-400 leading-relaxed italic border-l-2 border-blue-500/30 pl-4">{h.detailedAnalysis}</p>
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
          <Routes><Route path="/" element={dashboardElement} /><Route path="/portfolio" element={portfolioElement} /><Route path="/history" element={historyElement} /><Route path="/settings" element={settingsElement} /></Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
