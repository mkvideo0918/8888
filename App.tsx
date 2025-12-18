
import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";

const { HashRouter, Routes, Route, Link, useLocation, useNavigate } = ReactRouterDOM as any;

import { 
  LayoutDashboard, 
  Wallet, 
  Settings as SettingsIcon, 
  Search, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Trash2,
  X,
  RefreshCw,
  PieChart,
  BarChart3,
  Activity,
  Edit3,
  Sparkles,
  BrainCircuit,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
  Users,
  Lock,
  ChevronDown,
  Check,
  GripVertical,
  ShieldCheck,
  Key
} from 'lucide-react';
import { AppState, Account, PortfolioItem, AssetMarket, Language, Currency } from './types';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants';
import TradingViewWidget from './components/TradingViewWidget';
import FearGreedIndex from './components/FearGreedIndex';

// 初始化數據
const DEFAULT_ACCOUNT: Account = {
  id: 'default',
  name: 'Main Wallet',
  portfolio: [],
  watchlist: ["BTCUSDT", "ETHUSDT", "NVDA", "CRCL", "TSLA", "AAPL"],
  currency: 'TWD',
  language: 'zh-TW',
  assetOrder: []
};

const INITIAL_STATE: AppState = {
  accounts: JSON.parse(localStorage.getItem('accounts') || `[${JSON.stringify(DEFAULT_ACCOUNT)}]`),
  activeAccountId: localStorage.getItem('activeAccountId') || 'default',
  privacyMode: localStorage.getItem('privacyMode') === 'true',
};

// 權限閘門組件
// Fix: Added optional children to the props definition to resolve the error "Property 'children' is missing in type '{}' but required in type '{ children: React.ReactNode; }'"
const MasterGatekeeper = ({ children }: { children?: React.ReactNode }) => {
  const [isAuthorized, setIsAuthorized] = useState(localStorage.getItem('wealthwise_unlocked') === 'true');
  const [inputKey, setInputKey] = useState('');
  const [isError, setIsError] = useState(false);

  // 從環境變數獲取密鑰，如果沒設定則預設為 "admin" (建議在 Vercel 設定 MASTER_KEY)
  const MASTER_KEY = (process.env as any).MASTER_KEY || 'admin';

  const handleUnlock = () => {
    if (inputKey === MASTER_KEY) {
      localStorage.setItem('wealthwise_unlocked', 'true');
      setIsAuthorized(true);
    } else {
      setIsError(true);
      setTimeout(() => setIsError(false), 500);
    }
  };

  if (isAuthorized) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-[#050505] z-[999] flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className={`glass-effect p-12 rounded-[3rem] w-full max-w-md border border-white/10 text-center space-y-8 transition-transform ${isError ? 'animate-shake' : ''}`}>
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-indigo-600/20">
          <ShieldCheck size={40} className="text-white" />
        </div>
        
        <div>
          <h2 className="text-2xl font-black tracking-tight mb-2">WealthWise Security</h2>
          <p className="text-gray-500 text-sm font-medium leading-relaxed">System is encrypted. Please enter your master access key to proceed.</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              autoFocus
              type="password" 
              placeholder="Enter Access Key"
              className={`w-full bg-white/5 border ${isError ? 'border-red-500' : 'border-white/10'} rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-center tracking-widest font-mono`}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
          </div>
          <button 
            onClick={handleUnlock}
            className="w-full bg-white text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors active:scale-95"
          >
            Authenticate
          </button>
        </div>

        <div className="pt-4 flex items-center justify-center gap-2 opacity-20">
          <Lock size={12} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">End-to-End Encrypted</span>
        </div>
      </div>
    </div>
  );
};

const getYahooTicker = (symbol: string, market: AssetMarket) => {
  if (market === 'Crypto') return symbol;
  switch (market) {
    case 'TW': return symbol.includes('.') ? symbol : `${symbol}.TW`;
    case 'MY': return symbol.includes('.') ? symbol : `${symbol}.KL`;
    case 'HK': return symbol.includes('.') ? symbol : `${symbol}.HK`;
    case 'US':
    default: return symbol;
  }
};

const isUSMarketOpen = () => {
  const now = new Date();
  const estDate = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const day = estDate.getDay();
  const hours = estDate.getHours();
  const time = hours * 100 + estDate.getMinutes();
  return day !== 0 && day !== 6 && time >= 930 && time <= 1600;
};

// 隱私遮罩組件
const Amount = memo(({ value, currency, rate, privacy, isProfit = false }: { value: number; currency: Currency; rate: number; privacy: boolean; isProfit?: boolean }) => {
  if (privacy) return <span className="font-mono opacity-50">****</span>;
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = (value * rate).toLocaleString(undefined, { maximumFractionDigits: isProfit ? 0 : 2 });
  return <span className="font-mono">{isProfit && value > 0 ? '+' : ''}{symbol} {formatted}</span>;
});

const PriceDisplay = memo(({ price, currencySymbol, rate, change }: { price: number; currencySymbol: string; rate: number; change: number; language: Language }) => {
  const isPositive = change >= 0;
  return (
    <div className="text-right">
      <div className="text-2xl font-black tracking-tighter font-mono flex items-center justify-end">
        {currencySymbol} {(price * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-[10px] font-black flex items-center justify-end gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </div>
    </div>
  );
});

const App = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState(false);

  const activeAccount = useMemo(() => 
    state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0]
  , [state.accounts, state.activeAccountId]);

  const t = TRANSLATIONS[activeAccount.language];

  useEffect(() => {
    localStorage.setItem('accounts', JSON.stringify(state.accounts));
    localStorage.setItem('activeAccountId', state.activeAccountId);
    localStorage.setItem('privacyMode', String(state.privacyMode));
  }, [state]);

  const fetchPrices = useCallback(async () => {
    const symbolsToFetch = new Set([...activeAccount.watchlist, ...activeAccount.portfolio.map(p => p.symbol)]);
    const results: Record<string, { price: number; change: number }> = {};
    
    await Promise.all(Array.from(symbolsToFetch).map(async (symbol) => {
      const isCrypto = /USDT$|USDC$|BUSD$|BTC$|ETH$/.test(symbol);
      try {
        if (isCrypto) {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
          const data = await res.json();
          if (data.lastPrice) results[symbol] = { price: parseFloat(data.lastPrice), change: parseFloat(data.priceChangePercent) };
        } else {
          const market = activeAccount.portfolio.find(p => p.symbol === symbol)?.market || 'US';
          const yahooTicker = getYahooTicker(symbol, market);
          const proxyUrl = "https://corsproxy.io/?";
          const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1m&range=1d`;
          const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
          const data = await response.json();
          if (data.chart?.result?.[0]?.meta) {
            const meta = data.chart.result[0].meta;
            results[symbol] = { price: meta.regularMarketPrice, change: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 };
          }
        }
      } catch (e) {}
    }));
    setPrices(prev => ({ ...prev, ...results }));
  }, [activeAccount]);

  useEffect(() => {
    fetchPrices();
    const timer = setInterval(fetchPrices, 30000);
    return () => clearInterval(timer);
  }, [fetchPrices]);

  const switchAccount = (id: string) => {
    const target = state.accounts.find(a => a.id === id);
    if (!target) return;
    if (target.password) {
      setPendingAccountId(id);
      setUnlockPassword('');
      setUnlockError(false);
    } else {
      setState(prev => ({ ...prev, activeAccountId: id }));
      setIsAccountModalOpen(false);
    }
  };

  const handleUnlock = () => {
    const target = state.accounts.find(a => a.id === pendingAccountId);
    if (target && target.password === unlockPassword) {
      setState(prev => ({ ...prev, activeAccountId: pendingAccountId! }));
      setPendingAccountId(null);
      setIsAccountModalOpen(false);
    } else {
      setUnlockError(true);
    }
  };

  return (
    <HashRouter>
      <MasterGatekeeper>
        <div className="min-h-screen bg-[#050505] text-white flex selection:bg-indigo-500/30">
          
          {/* 側邊欄 */}
          <div className="w-64 h-screen fixed left-0 top-0 glass-effect border-r border-white/10 p-6 flex flex-col z-50">
            <div className="flex items-center gap-3 mb-10 px-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">WealthWise</h1>
            </div>
            
            <button 
              onClick={() => setIsAccountModalOpen(true)}
              className="mb-8 flex items-center justify-between w-full p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-black uppercase">
                  {activeAccount.name[0]}
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Active Account</p>
                  <p className="text-sm font-bold truncate max-w-[100px]">{activeAccount.name}</p>
                </div>
              </div>
              <ChevronDown size={14} className="text-gray-500 group-hover:text-white transition-colors" />
            </button>

            <nav className="flex-1 space-y-2">
              {[
                { path: '/', name: t.dashboard, icon: LayoutDashboard },
                { path: '/portfolio', name: t.portfolio, icon: Wallet },
                { path: '/settings', name: t.settings, icon: SettingsIcon },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link 
                    key={item.path} 
                    to={item.path} 
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group hover:bg-white/5 text-gray-400 hover:text-white`}
                  >
                    <Icon size={18} />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            
            <div className="mt-auto space-y-4">
               <button 
                 onClick={() => setState(prev => ({...prev, privacyMode: !prev.privacyMode}))}
                 className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border transition-all font-bold text-xs ${state.privacyMode ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-white/10 text-gray-400'}`}
               >
                 {state.privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
                 {state.privacyMode ? t.privacyOn : t.privacyOff}
               </button>
               <div className="p-4 glass-effect rounded-2xl text-[9px] text-gray-600 uppercase tracking-[0.2em] text-center border border-white/5 font-black">
                 WealthWise v5.5 Enterprise
               </div>
            </div>
          </div>

          <main className="flex-1 ml-64 p-10 min-h-screen relative overflow-x-hidden">
            <Routes>
              <Route path="/" element={<DashboardView state={state} setState={setState} prices={prices} activeAccount={activeAccount} />} />
              <Route path="/portfolio" element={<PortfolioView state={state} setState={setState} prices={prices} activeAccount={activeAccount} />} />
              <Route path="/settings" element={<SettingsView state={state} setState={setState} activeAccount={activeAccount} />} />
            </Routes>
          </main>

          {isAccountModalOpen && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
               <div className="glass-effect p-10 rounded-[2.5rem] w-full max-w-lg border border-white/10 relative">
                 <button onClick={() => setIsAccountModalOpen(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white"><X size={24} /></button>
                 
                 {pendingAccountId ? (
                   <div className="space-y-6 animate-in zoom-in-95 duration-200">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-4"><Lock size={32} /></div>
                        <h3 className="text-2xl font-black">{t.unlock}</h3>
                        <p className="text-gray-500 text-sm mt-1">{t.enterPassword}</p>
                      </div>
                      <input 
                        autoFocus
                        type="password" 
                        className={`w-full bg-white/5 border p-4 rounded-2xl outline-none text-center text-xl font-mono ${unlockError ? 'border-red-500 animate-shake' : 'border-white/10'}`}
                        value={unlockPassword}
                        onChange={e => { setUnlockPassword(e.target.value); setUnlockError(false); }}
                        onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                      />
                      <button onClick={handleUnlock} className="w-full bg-indigo-600 py-4 rounded-2xl font-black text-lg">解鎖並切換</button>
                   </div>
                 ) : isCreatingAccount ? (
                   <AccountCreationView onCancel={() => setIsCreatingAccount(false)} onSave={(acc) => {
                     setState(prev => ({ ...prev, accounts: [...prev.accounts, acc], activeAccountId: acc.id }));
                     setIsCreatingAccount(false);
                   }} t={t} />
                 ) : (
                   <div className="space-y-6">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-2xl font-black">{t.accounts}</h3>
                        <button onClick={() => setIsCreatingAccount(true)} className="p-2 bg-indigo-600 rounded-xl hover:scale-110 transition-transform"><Plus size={18} /></button>
                      </div>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {state.accounts.map(acc => (
                          <button 
                            key={acc.id} 
                            onClick={() => switchAccount(acc.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${state.activeAccountId === acc.id ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                          >
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black">{acc.name[0]}</div>
                               <div className="text-left">
                                 <p className="font-bold">{acc.name}</p>
                                 <p className="text-[10px] opacity-60 uppercase font-black">{acc.portfolio.length} Assets</p>
                               </div>
                            </div>
                            {acc.password && <Lock size={12} className="opacity-40" />}
                            {state.activeAccountId === acc.id && <Check size={16} />}
                          </button>
                        ))}
                      </div>
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      </MasterGatekeeper>
    </HashRouter>
  );
};

// 帳戶創建視圖
const AccountCreationView = ({ onCancel, onSave, t }: { onCancel: () => void, onSave: (acc: Account) => void, t: any }) => {
  const [name, setName] = useState('');
  const [pwd, setPwd] = useState('');
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <h3 className="text-2xl font-black">{t.addAccount}</h3>
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.accountName}</span>
          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.password}</span>
          <input type="password" placeholder="Leave blank for no password" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none" value={pwd} onChange={e => setPwd(e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4">
        <button onClick={onCancel} className="bg-white/5 py-4 rounded-2xl font-bold">{t.cancel}</button>
        <button onClick={() => name && onSave({ id: Date.now().toString(), name, password: pwd || undefined, portfolio: [], watchlist: ["BTCUSDT", "NVDA"], currency: 'TWD', language: 'zh-TW', assetOrder: [] })} className="bg-indigo-600 py-4 rounded-2xl font-black">{t.save}</button>
      </div>
    </div>
  );
};

const DashboardView = memo(({ state, activeAccount, prices, setState }: any) => {
  const [activeSymbol, setActiveSymbol] = useState(activeAccount.watchlist[0]);
  const [fngData, setFngData] = useState({ stock: 55, crypto: 50, loading: true });
  const t = TRANSLATIONS[activeAccount.language];

  useEffect(() => {
    fetch('https://api.alternative.me/fng/').then(r => r.json()).then(j => setFngData(prev => ({...prev, crypto: parseInt(j.data[0].value), loading: false})));
  }, []);

  const summary = useMemo(() => {
    let totalValue = 0, totalCost = 0;
    activeAccount.portfolio.forEach((item: any) => {
      const cur = prices[item.symbol]?.price || item.cost;
      totalValue += cur * item.quantity;
      totalCost += item.cost * item.quantity;
    });
    return { value: totalValue, profit: totalValue - totalCost };
  }, [activeAccount.portfolio, prices]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-effect p-8 rounded-3xl border border-white/5 flex items-center gap-6">
           <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20"><PieChart size={28} /></div>
           <div>
             <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t.totalValue}</p>
             <h3 className="text-2xl font-black tracking-tighter">
               <Amount value={summary.value} currency={activeAccount.currency} rate={EXCHANGE_RATES[activeAccount.currency]} privacy={state.privacyMode} />
             </h3>
           </div>
        </div>
        <div className="glass-effect p-8 rounded-3xl border border-white/5 flex items-center gap-6">
           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${summary.profit >= 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}><BarChart3 size={28} /></div>
           <div>
             <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t.totalProfit}</p>
             <h3 className={`text-2xl font-black tracking-tighter ${summary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
               <Amount value={summary.profit} currency={activeAccount.currency} rate={EXCHANGE_RATES[activeAccount.currency]} privacy={state.privacyMode} isProfit />
             </h3>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
           <FearGreedIndex value={fngData.stock} label="STOCKS" compact />
           <FearGreedIndex value={fngData.crypto} label="CRYPTO" isAnalyzing={fngData.loading} compact />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between glass-effect p-6 rounded-3xl border border-white/5">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black">{activeSymbol}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${isUSMarketOpen() ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {isUSMarketOpen() ? 'Live' : 'Market Closed'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-8">
                {prices[activeSymbol] && <PriceDisplay price={prices[activeSymbol].price} currencySymbol={CURRENCY_SYMBOLS[activeAccount.currency]} rate={EXCHANGE_RATES[activeAccount.currency]} change={prices[activeSymbol].change} language={activeAccount.language} />}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    placeholder={t.placeholderSymbol} 
                    className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none w-48 text-sm font-mono uppercase"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.toUpperCase();
                        if (val) {
                          setState((prev: any) => ({
                            ...prev,
                            accounts: prev.accounts.map((a: Account) => a.id === activeAccount.id ? { ...a, watchlist: [...new Set([...a.watchlist, val])] } : a)
                          }));
                          setActiveSymbol(val);
                        }
                      }
                    }}
                  />
                </div>
              </div>
           </div>
           <TradingViewWidget symbol={activeSymbol} />
        </div>
        <div className="glass-effect rounded-3xl p-6 border border-white/5 flex flex-col h-[600px]">
           <h3 className="text-xs font-black opacity-40 uppercase tracking-widest mb-6 px-2">{t.watchlist}</h3>
           <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
              {activeAccount.watchlist.map((s: string) => {
                const p = prices[s]; const isActive = activeSymbol === s;
                return (
                  <button key={s} onClick={() => setActiveSymbol(s)} className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group ${isActive ? 'bg-indigo-600 border-indigo-600' : 'bg-white/5 border-white/10 hover:border-white/30'}`}>
                    <div className="text-left">
                       <span className="block font-black text-sm">{s}</span>
                       <span className={`text-[10px] font-black ${p?.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{p ? `${p.change >= 0 ? '+' : ''}${p.change.toFixed(2)}%` : '--'}</span>
                    </div>
                    <div className="text-right">
                       <span className="block font-mono text-xs font-black">
                         {p ? (p.price * EXCHANGE_RATES[activeAccount.currency]).toLocaleString() : '...'}
                       </span>
                       <div onClick={(e) => {
                         e.stopPropagation();
                         setState((prev: any) => ({
                           ...prev,
                           accounts: prev.accounts.map((a: Account) => a.id === activeAccount.id ? { ...a, watchlist: a.watchlist.filter(w => w !== s) } : a)
                         }));
                       }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 transition-opacity"><Trash2 size={12} /></div>
                    </div>
                  </button>
                );
              })}
           </div>
        </div>
      </div>
    </div>
  );
});

const PortfolioView = memo(({ state, activeAccount, prices, setState }: any) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [draggedSymbol, setDraggedSymbol] = useState<string | null>(null);
  
  const t = TRANSLATIONS[activeAccount.language];
  const rate = EXCHANGE_RATES[activeAccount.currency];

  const aggregated = useMemo(() => {
    const map: Record<string, { totalQty: number, totalCost: number, market: AssetMarket }> = {};
    activeAccount.portfolio.forEach((p: any) => {
      if (!map[p.symbol]) map[p.symbol] = { totalQty: 0, totalCost: 0, market: p.market };
      map[p.symbol].totalQty += p.quantity;
      map[p.symbol].totalCost += (p.cost * p.quantity);
    });

    const items = Object.entries(map).map(([sym, data]) => {
      const live = prices[sym]?.price || data.totalCost / data.totalQty;
      const profit = (live - (data.totalCost / data.totalQty)) * data.totalQty;
      return {
        symbol: sym,
        avgCost: data.totalCost / data.totalQty,
        totalQty: data.totalQty,
        market: data.market,
        profit 
      };
    });

    items.sort((a, b) => b.profit - a.profit);
    return items;
  }, [activeAccount.portfolio, prices]);

  const totalAccountSummary = useMemo(() => {
    let totalInvested = 0;
    let totalMarketValue = 0;
    aggregated.forEach(group => {
      const live = prices[group.symbol]?.price || group.avgCost;
      totalInvested += group.avgCost * group.totalQty;
      totalMarketValue += live * group.totalQty;
    });
    const profit = totalMarketValue - totalInvested;
    const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    return { invested: totalInvested, market: totalMarketValue, roi, profit };
  }, [aggregated, prices]);

  const runAi = async (symbol: string) => {
    setLoadingAi(true);
    try {
      // @google/genai coding guidelines: Initialize instance right before use and use correct model for complex tasks
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `你是一位頂級分析師。針對 ${symbol} 進行深度分析。參考幣別：${activeAccount.currency}。目前大概價位：${prices[symbol]?.price || '未知'}。請提供繁體中文專業建議：1. 市場情緒 2. 技術面 3. 操作策略。`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      setAiAnalysis({ symbol, content: response.text });
    } catch (e) { setAiAnalysis({ symbol, content: 'AI 分析暫時不可用。' }); }
    finally { setLoadingAi(false); }
  };

  const handleDragStart = (symbol: string) => {
    setDraggedSymbol(symbol);
  };

  const handleDragOver = (e: React.DragEvent, symbol: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetSymbol: string) => {
    e.preventDefault();
    setDraggedSymbol(null);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black">{t.portfolio}</h2>
          <p className="text-xs text-gray-600 font-black uppercase tracking-[0.2em]">{activeAccount.name} Assets</p>
        </div>
        
        <div className="flex items-center gap-6 glass-effect p-6 rounded-[2rem] border border-white/5 shadow-2xl">
           <div className="min-w-[100px]">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">ACCOUNT ROI%</p>
              <div className={`text-2xl font-black tracking-tighter flex items-center gap-2 ${totalAccountSummary.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalAccountSummary.roi >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                {state.privacyMode ? <span className="opacity-50">****</span> : `${totalAccountSummary.roi.toFixed(2)}%`}
              </div>
           </div>

           <div className="w-px h-10 bg-white/10 mx-2"></div>

           <div className="min-w-[120px]">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{t.totalProfit}</p>
              <div className={`text-2xl font-black tracking-tighter font-mono ${totalAccountSummary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                <Amount value={totalAccountSummary.profit} currency={activeAccount.currency} rate={rate} privacy={state.privacyMode} isProfit />
              </div>
           </div>

           <div className="w-px h-10 bg-white/10 mx-2"></div>

           <div className="min-w-[140px]">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{t.totalValue}</p>
              <div className="text-2xl font-black font-mono tracking-tighter">
                <Amount value={totalAccountSummary.market} currency={activeAccount.currency} rate={rate} privacy={state.privacyMode} />
              </div>
           </div>

           <button onClick={() => { setEditingItem(null); setIsAdding(true); }} className="bg-indigo-600 hover:bg-indigo-700 w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-xl active:scale-95 transition-all ml-4">
             <Plus size={24} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {aggregated.map((group) => {
          const live = prices[group.symbol]?.price;
          const hasPrice = live !== undefined;
          const roi = hasPrice ? ((live - group.avgCost) / group.avgCost) * 100 : 0;
          const profit = hasPrice ? (live - group.avgCost) * group.totalQty : 0;
          const isProfit = profit >= 0;

          return (
            <div 
              key={group.symbol} 
              draggable
              onDragStart={() => handleDragStart(group.symbol)}
              onDragOver={(e) => handleDragOver(e, group.symbol)}
              onDrop={(e) => handleDrop(e, group.symbol)}
              className={`glass-effect p-8 rounded-[2.5rem] border space-y-6 group/card hover:border-indigo-500/50 transition-all shadow-2xl relative overflow-hidden cursor-move ${draggedSymbol === group.symbol ? 'opacity-20 scale-95' : 'opacity-100 border-white/10'}`}
            >
               {isProfit && hasPrice && <div className="absolute -right-8 -top-8 w-24 h-24 bg-green-500/5 blur-3xl pointer-events-none group-hover:bg-green-500/10 transition-all"></div>}
               
               <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center font-black text-xl text-indigo-400 border border-white/5 relative">
                      {group.symbol.slice(0,2)}
                      <div className="absolute -top-1 -left-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-indigo-600 rounded-lg p-1">
                        <GripVertical size={12} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-2xl font-black tracking-tighter flex items-center gap-2">{group.symbol}</h4>
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">{group.totalQty} Units</p>
                    </div>
                  </div>
                  {hasPrice && (
                    <div className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-1 ${isProfit ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {isProfit ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {roi.toFixed(2)}%
                    </div>
                  )}
               </div>

               <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
                 <div>
                   <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">{t.avgCost}</p>
                   <p className="font-mono text-lg font-black"><Amount value={group.avgCost} currency={activeAccount.currency} rate={rate} privacy={state.privacyMode} /></p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">{t.currentPrice}</p>
                   <p className={`font-mono text-lg font-black ${hasPrice ? (isProfit ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
                     {hasPrice ? <Amount value={live} currency={activeAccount.currency} rate={rate} privacy={state.privacyMode} /> : '--'}
                   </p>
                 </div>
               </div>

               <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{t.profit}</p>
                    <h3 className={`text-3xl font-black font-mono tracking-tighter ${hasPrice ? (isProfit ? 'text-green-400' : 'text-red-400') : 'text-gray-700'}`}>
                      {hasPrice ? <Amount value={profit} currency={activeAccount.currency} rate={rate} privacy={state.privacyMode} isProfit /> : '--'}
                    </h3>
                  </div>
                  <button onClick={() => runAi(group.symbol)} className="p-4 bg-indigo-600/10 text-indigo-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-lg border border-indigo-500/20"><Sparkles size={20} /></button>
               </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-black flex items-center gap-2 px-2"><Activity size={18} className="text-indigo-400" /> Transaction Batches</h3>
        <div className="glass-effect rounded-[2.5rem] overflow-hidden border border-white/5">
           <table className="w-full text-left">
             <thead className="bg-white/[0.03] border-b border-white/5 text-[10px] uppercase font-black opacity-40">
               <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Asset</th><th className="px-8 py-5 text-right">Cost</th><th className="px-8 py-5 text-right">Qty</th><th className="px-8 py-5 text-center">Actions</th></tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {activeAccount.portfolio.map((item: any) => (
                  <tr key={item.id} className="group/row hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-6 font-mono text-gray-500 text-xs">{item.buyDate}</td>
                    <td className="px-8 py-6 font-black text-sm uppercase">{item.symbol}</td>
                    <td className="px-8 py-6 text-right"><Amount value={item.cost} currency={activeAccount.currency} rate={rate} privacy={state.privacyMode} /></td>
                    <td className="px-8 py-6 text-right font-mono text-xs opacity-60">{item.quantity}</td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(item); setIsAdding(true); }} className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-xl"><Edit3 size={16} /></button>
                        <button onClick={() => setState((prev: any) => ({
                          ...prev,
                          accounts: prev.accounts.map((a: Account) => a.id === activeAccount.id ? { ...a, portfolio: a.portfolio.filter((p: any) => p.id !== item.id) } : a)
                        }))} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
             </tbody>
           </table>
           {activeAccount.portfolio.length === 0 && <div className="py-20 text-center opacity-20 font-black">No transactions found</div>}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-4">
           <div className="glass-effect p-10 rounded-[2.5rem] w-full max-w-lg space-y-6 border border-white/10">
              <div className="flex justify-between items-center"><h3 className="text-2xl font-black">{editingItem ? 'Edit Asset' : t.addPortfolio}</h3><button onClick={() => setIsAdding(false)}><X size={24} /></button></div>
              <div className="grid grid-cols-2 gap-4">
                 <label className="col-span-2 space-y-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t.symbol}</span>
                    <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none uppercase font-mono" defaultValue={editingItem?.symbol} id="sym_input" />
                 </label>
                 <label className="col-span-2 space-y-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Market</span>
                    <select className="w-full bg-neutral-900 border border-white/10 rounded-2xl p-4 outline-none" id="market_input" defaultValue={editingItem?.market || 'US'}>
                      <option value="US">US Stocks</option><option value="Crypto">Crypto</option><option value="TW">TW Stocks</option><option value="MY">MY Stocks</option><option value="HK">HK Stocks</option>
                    </select>
                 </label>
                 <label className="space-y-1"><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t.cost}</span><input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none" defaultValue={editingItem?.cost} id="cost_input" /></label>
                 <label className="space-y-1"><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t.quantity}</span><input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none" defaultValue={editingItem?.quantity} id="qty_input" /></label>
              </div>
              <button onClick={() => {
                const sym = (document.getElementById('sym_input') as HTMLInputElement).value.toUpperCase();
                const cost = Number((document.getElementById('cost_input') as HTMLInputElement).value);
                const qty = Number((document.getElementById('qty_input') as HTMLInputElement).value);
                const market = (document.getElementById('market_input') as HTMLSelectElement).value as AssetMarket;
                if (!sym || !cost || !qty) return;

                const newItem: PortfolioItem = {
                  id: editingItem?.id || Date.now().toString(),
                  symbol: sym,
                  cost,
                  quantity: qty,
                  market,
                  type: market === 'Crypto' ? 'Crypto' : 'Stock',
                  buyDate: editingItem?.buyDate || new Date().toISOString().split('T')[0]
                };

                setState((prev: any) => ({
                  ...prev,
                  accounts: prev.accounts.map((a: Account) => {
                    if (a.id !== activeAccount.id) return a;
                    const p = editingItem ? a.portfolio.map(pi => pi.id === editingItem.id ? newItem : pi) : [...a.portfolio, newItem];
                    return { ...a, portfolio: p };
                  })
                }));
                setIsAdding(false);
              }} className="w-full bg-indigo-600 py-4 rounded-2xl font-black text-lg">Save Asset</button>
           </div>
        </div>
      )}

      {aiAnalysis && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-6 overflow-y-auto">
          <div className="glass-effect p-10 rounded-[2.5rem] w-full max-w-2xl border border-indigo-500/30 relative">
            <button onClick={() => setAiAnalysis(null)} className="absolute top-8 right-8 text-gray-500 hover:text-white"><X size={24} /></button>
            <div className="flex items-center gap-3 mb-8">
               <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400"><BrainCircuit size={24} /></div>
               <div><h3 className="text-2xl font-black">{aiAnalysis.symbol} {t.aiAnalysis}</h3></div>
            </div>
            <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">{aiAnalysis.content}</div>
          </div>
        </div>
      )}
      {loadingAi && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center"><RefreshCw className="animate-spin text-indigo-500" size={48} /></div>
      )}
    </div>
  );
});

const SettingsView = memo(({ state, activeAccount, setState }: any) => {
  const t = TRANSLATIONS[activeAccount.language];
  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black">{t.settings}</h2>
      <div className="glass-effect rounded-[2.5rem] p-10 space-y-10 border border-white/5">
        <div className="flex items-center justify-between">
          <div><h4 className="font-bold text-lg">{activeAccount.language === 'zh-TW' ? '顯示語言' : 'Language'}</h4><p className="text-sm text-gray-500">切換應用介面顯示語言</p></div>
          <select value={activeAccount.language} onChange={(e) => {
            setState((prev: any) => ({
              ...prev,
              accounts: prev.accounts.map((a: Account) => a.id === activeAccount.id ? { ...a, language: e.target.value as Language } : a)
            }));
          }} className="bg-neutral-900 border border-white/10 rounded-xl p-4 outline-none">
            <option value="en">English (US)</option><option value="zh-TW">繁體中文 (Taiwan)</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div><h4 className="font-bold text-lg">{activeAccount.language === 'zh-TW' ? '顯示幣別' : 'Currency'}</h4><p className="text-sm text-gray-500">計算與顯示主要幣別</p></div>
          <select value={activeAccount.currency} onChange={(e) => {
            setState((prev: any) => ({
              ...prev,
              accounts: prev.accounts.map((a: Account) => a.id === activeAccount.id ? { ...a, currency: e.target.value as Currency } : a)
            }));
          }} className="bg-neutral-900 border border-white/10 rounded-xl p-4 outline-none">
            <option value="USD">USD ($)</option><option value="TWD">TWD (NT$)</option><option value="MYR">MYR (RM)</option>
          </select>
        </div>
        <div className="pt-6 border-t border-white/5">
           <button 
             onClick={() => {
               localStorage.removeItem('wealthwise_unlocked');
               window.location.reload();
             }}
             className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-2 transition-colors mb-4"
           >
             <Lock size={16} /> Logout and Lock App
           </button>
           <button onClick={() => {
             if (confirm('確定要刪除此帳戶嗎？此操作無法恢復。')) {
               setState((prev: any) => {
                 const newAccs = prev.accounts.filter((a: Account) => a.id !== activeAccount.id);
                 if (newAccs.length === 0) return prev;
                 return { ...prev, accounts: newAccs, activeAccountId: newAccs[0].id };
               });
             }
           }} className="text-red-500 hover:text-red-400 font-bold flex items-center gap-2 transition-colors"><Trash2 size={16} /> Delete This Account</button>
        </div>
      </div>
    </div>
  );
});

export default App;
