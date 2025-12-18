
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
  Minimize2,
  Key,
  CreditCard
} from 'lucide-react';
import { AppState, Language, Currency, PortfolioItem, AnalysisHistory } from './types';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants';
import TradingViewWidget from './components/TradingViewWidget';
import FearGreedIndex from './components/FearGreedIndex';
import { analyzeMarket, getChatResponseStream, getFearGreedIndices } from './services/geminiService';

// Fix: Use any to bypass redeclaration error with predefined global AIStudio type
declare global {
  interface Window {
    aistudio: any;
  }
}

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
      <div className="mt-auto p-4 glass-effect rounded-2xl text-[10px] text-gray-500 uppercase tracking-[0.2em] text-center border border-white/5">Master Engine v3.5 Stable</div>
    </div>
  );
});

const Dashboard = memo(({ state, setState, onKeyRequest }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>>, onKeyRequest: () => void }) => {
  const [activeSymbol, setActiveSymbol] = useState(state.watchlist[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFetchingFNG, setIsFetchingFNG] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [marketOpen, setMarketOpen] = useState(isUSMarketOpen());
  
  const [stockSentiment, setStockSentiment] = useState<{score: number, label: string} | null>(null);
  const [cryptoSentiment, setCryptoSentiment] = useState<{score: number, label: string} | null>(null);

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
      }
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") onKeyRequest();
    } finally {
      setIsFetchingFNG(false);
    }
  }, [state.language, onKeyRequest]);

  useEffect(() => {
    fetchFearGreedData();
    const interval = setInterval(fetchFearGreedData, 3600000); 
    return () => clearInterval(interval);
  }, [fetchFearGreedData]);

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
    setMessages([{ role: 'model', text: "正在調用大師模型進行數據穿透分析..." }]); 
    try {
      const result = await analyzeMarket(activeSymbol, state.language);
      if (result) {
        const report = `【金融大師報告：${activeSymbol}】\n投資建議：${result.recommendation}\n理由：${result.summary}\n技術位：${result.keyLevels.join(' | ')}\n\n詳情報告：\n${result.detailedAnalysis}`;
        setMessages([{ role: 'model', text: report }]);
        setState(prev => ({ ...prev, history: [{ id: Date.now().toString(), symbol: activeSymbol, timestamp: Date.now(), ...result }, ...prev.history].slice(0, 50) }));
      }
    } catch(e: any) {
      if (e.message === "API_KEY_MISSING") { onKeyRequest(); setMessages([]); }
      else setMessages([{ role: 'model', text: `連線異常: ${e.message}` }]);
    } finally { setIsAnalyzing(false); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isAnalyzing) return;
    const userMsg = inputValue.trim();
    setInputValue('');
    const history = [...messages];
    setMessages(prev => [...prev, { role: 'user', text: userMsg }, { role: 'model', text: "" } ]);
    setIsAnalyzing(true);
    try {
      await getChatResponseStream(activeSymbol, history, userMsg, state.language, (text) => {
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0) updated[updated.length - 1].text = text;
          return updated;
        });
      });
    } catch (error: any) {
      if (error.message === "API_KEY_MISSING") { onKeyRequest(); setMessages(history); }
      else {
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0) updated[updated.length - 1].text = `連線失敗: ${error.message}`;
          return updated;
        });
      }
    } finally { setIsAnalyzing(false); }
  };

  const renderAnalyst = (isFull = false) => (
    <div className={`glass-effect rounded-2xl flex flex-col border border-white/10 relative overflow-hidden shadow-2xl transition-all duration-300 ${isFull ? 'fixed inset-4 md:inset-10 z-[100] bg-[#0c0c0c]' : 'h-[480px]'}`}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
            <Bot size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wide uppercase">{t.aiAnalyst}</h3>
            <span className="text-[8px] text-blue-500 font-mono tracking-widest uppercase animate-pulse">Master Engine v3.5 Stable</span>
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
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <Bot size={56} className="mb-4 text-blue-500/50" />
            <p className="text-base font-bold text-white">大師智庫已連線</p>
            <p className="text-[11px] mt-2 leading-relaxed px-10">詢問關於 ${activeSymbol} 的走勢，或是點擊「AI 深度分析」產生報告。</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[90%] rounded-2xl px-5 py-4 text-[13px] leading-relaxed shadow-xl ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-none font-medium'}`}>
                <div className="flex items-center gap-2 mb-2 opacity-50 text-[9px] font-black tracking-widest uppercase border-b border-white/5 pb-1">
                  {m.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                  <span>{m.role === 'user' ? 'Investor' : 'AI MASTER'}</span>
                </div>
                <div className="whitespace-pre-wrap">{m.text || (isAnalyzing && i === messages.length - 1 ? "正在連線智庫..." : "")}</div>
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
          placeholder="詢問大師市場看法..." 
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-blue-500 transition-all" 
          disabled={isAnalyzing} 
        />
        <button 
          type="submit" 
          disabled={!inputValue.trim() || isAnalyzing} 
          className="bg-blue-600 text-white px-5 rounded-2xl hover:bg-blue-700 shadow-xl disabled:opacity-30"
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
          <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5 relative">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{activeSymbol}</h2>
                {!/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(activeSymbol) && !marketOpen && <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1 font-bold"><Clock size={10} /> 休市</span>}
              </div>
              <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">市場概覽</span>
            </div>
            <div className="flex items-center gap-6">
              {prices[activeSymbol] && <PriceDisplay price={prices[activeSymbol].price} currencySymbol={CURRENCY_SYMBOLS[state.currency]} rate={EXCHANGE_RATES[state.currency]} change={prices[activeSymbol].change} isMarketClosed={!/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(activeSymbol) && !marketOpen} language={state.language} />}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input type="text" placeholder={t.placeholderSymbol} className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-48 text-sm uppercase"
                  onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.toUpperCase();
                        if (val) {
                          if (!state.watchlist.includes(val)) setState(prev => ({ ...prev, watchlist: [...prev.watchlist, val] }));
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
            <FearGreedIndex value={stockSentiment?.score ?? 50} label={isFetchingFNG ? '分析中...' : (stockSentiment?.label ?? 'Neutral')} isAnalyzing={isFetchingFNG} compact />
            <FearGreedIndex value={cryptoSentiment?.score ?? 50} label={isFetchingFNG ? '分析中...' : (cryptoSentiment?.label ?? 'Neutral')} isAnalyzing={isFetchingFNG} compact />
          </div>
          {renderAnalyst(false)}
        </div>
      </div>

      {isMaximized && (
        <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4">
           {renderAnalyst(true)}
           <button onClick={() => setIsMaximized(false)} className="fixed top-6 right-6 p-4 bg-white/10 hover:bg-red-500 rounded-full transition-all"><X size={28} /></button>
        </div>
      )}
    </div>
  );
});

const App = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [keySelected, setKeySelected] = useState<boolean | null>(null);

  const checkKey = useCallback(async () => {
    try {
      // 檢查是否已選擇 API Key
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const has = await window.aistudio.hasSelectedApiKey();
        setKeySelected(has);
      } else {
        // 如果不在 AI Studio 環境，嘗試讀取 process.env
        setKeySelected(!!process.env.API_KEY && process.env.API_KEY !== "undefined");
      }
    } catch (e) {
      setKeySelected(false);
    }
  }, []);

  useEffect(() => { checkKey(); }, [checkKey]);

  const handleOpenSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // 假設選擇成功並立刻嘗試啟動（避免 Race Condition）
      setKeySelected(true);
      window.location.reload(); // 重新整理以確保金鑰注入環境變數
    }
  };

  if (keySelected === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-effect rounded-[2.5rem] p-10 text-center space-y-8 border-2 border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.1)]">
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto ring-4 ring-blue-500/10">
            <Key className="w-10 h-10 text-blue-500" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">連線至 Google Gemini API</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              為了啟用 AI 大師分析功能，您需要選擇一個具備有效帳單資訊的 Google Cloud 專案。
            </p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleOpenSelectKey}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-3"
            >
              <Zap size={20} /> 選擇 API 金鑰
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              className="block text-[11px] text-gray-500 hover:text-blue-400 transition-colors uppercase tracking-widest font-bold"
            >
              查看帳單說明文件 <ExternalLink size={10} className="inline ml-1" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex">
        <Sidebar language={state.language} />
        <main className="flex-1 ml-64 p-8 min-h-screen relative">
          <Routes>
            <Route path="/" element={<Dashboard state={state} setState={setState} onKeyRequest={() => setKeySelected(false)} />} />
            {/* 其他 Route 保持原樣 */}
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
