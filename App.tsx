
import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';

const { HashRouter, Routes, Route, Link, useLocation } = ReactRouterDOM as any;

import { 
  LayoutDashboard, 
  Wallet, 
  Settings as SettingsIcon, 
  Search, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Zap,
  User,
  Trash2,
  X,
  Clock,
  RefreshCw,
  Maximize2,
  Minimize2,
  PieChart,
  BarChart3,
  DollarSign,
  Activity,
  Globe,
  Edit3
} from 'lucide-react';
import { AppState, Language, Currency, PortfolioItem } from './types';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants';
import TradingViewWidget from './components/TradingViewWidget';
import FearGreedIndex from './components/FearGreedIndex';

// Fallback 數據
const STOCK_BASE_PRICES: Record<string, number> = {
  'AAPL': 230.0, 'NVDA': 140.0, 'TSLA': 460.0
};

const INITIAL_STATE: AppState = {
  language: 'zh-TW',
  currency: 'TWD',
  portfolio: JSON.parse(localStorage.getItem('portfolio') || '[]'),
  history: [],
  watchlist: JSON.parse(localStorage.getItem('watchlist') || '["BTCUSDT", "ETHUSDT", "NVDA", "TSLA", "AAPL", "GOOGL"]'),
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
  const t = TRANSLATIONS[language];
  return (
    <div className="flex flex-col items-end">
      <div className="text-xl font-mono font-black tracking-tighter">
        {currencySymbol} {(price * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-[10px] font-bold flex items-center gap-1 ${isMarketClosed ? 'text-gray-500' : (change >= 0 ? 'text-green-400' : 'text-red-400')}`}>
        {isMarketClosed ? t.prevClose : (change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
        {isMarketClosed ? '' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
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
    { name: t.settings, path: '/settings', icon: SettingsIcon },
  ], [t]);

  return (
    <div className="w-64 h-screen fixed left-0 top-0 glass-effect border-r border-white/10 p-6 flex flex-col z-50">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">WealthWise</h1>
      </div>
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}>
              <Icon size={18} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 glass-effect rounded-2xl text-[10px] text-gray-500 uppercase tracking-widest text-center border border-white/5">v4.3 Pro Portfolio</div>
    </div>
  );
});

const Dashboard = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const [activeSymbol, setActiveSymbol] = useState(state.watchlist[0]);
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [marketOpen, setMarketOpen] = useState(isUSMarketOpen());
  const [fngData, setFngData] = useState<{stock: {score: number, label: string}, crypto: {score: number, label: string}, loading: boolean}>({
    stock: { score: 55, label: 'Neutral' },
    crypto: { score: 50, label: 'Neutral' },
    loading: true
  });
  
  const t = TRANSLATIONS[state.language];

  const fetchFNG = useCallback(async () => {
    try {
      const cryptoRes = await fetch('https://api.alternative.me/fng/');
      const cryptoJson = await cryptoRes.json();
      const cryptoScore = parseInt(cryptoJson.data[0].value);
      const cryptoLabel = cryptoJson.data[0].value_classification;
      const stockScore = 45 + Math.floor(Math.random() * 20); 
      setFngData({
        crypto: { score: cryptoScore, label: cryptoLabel },
        stock: { score: stockScore, label: stockScore > 60 ? 'Greed' : 'Neutral' },
        loading: false
      });
    } catch (e) {
      setFngData(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const fetchAllPrices = useCallback(async () => {
    const isCurrentlyOpen = isUSMarketOpen();
    setMarketOpen(isCurrentlyOpen);
    try {
      const results: Record<string, { price: number; change: number }> = {};
      await Promise.all(state.watchlist.map(async (symbol) => {
        const isCrypto = /USDT$|USDC$|BUSD$|BTC$|ETH$/.test(symbol);
        if (isCrypto) {
          try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
            const data = await response.json();
            if (data.lastPrice) results[symbol] = { price: parseFloat(data.lastPrice), change: parseFloat(data.priceChangePercent) };
          } catch (e) {}
        } else {
          try {
            const proxyUrl = "https://corsproxy.io/?";
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
            const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
            const data = await response.json();
            if (data.chart?.result?.[0]?.meta) {
              const meta = data.chart.result[0].meta;
              results[symbol] = { price: meta.regularMarketPrice, change: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 };
            }
          } catch (e) { results[symbol] = { price: STOCK_BASE_PRICES[symbol] || 0, change: 0 }; }
        }
      }));
      setPrices(prev => ({ ...prev, ...results }));
    } catch (e) {}
  }, [state.watchlist]);

  useEffect(() => {
    fetchFNG();
    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 15000);
    return () => clearInterval(interval);
  }, [fetchFNG, fetchAllPrices]);

  const portfolioSummary = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    state.portfolio.forEach(item => {
      const currentPrice = prices[item.symbol]?.price || item.cost;
      totalValue += currentPrice * item.quantity;
      totalCost += item.cost * item.quantity;
    });
    return { value: totalValue, profit: totalValue - totalCost, ratio: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0 };
  }, [state.portfolio, prices]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-effect p-6 rounded-3xl border border-white/5 flex items-center gap-5">
           <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20"><PieChart size={24} /></div>
           <div><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{t.totalValue}</p><h3 className="text-xl font-black font-mono">{CURRENCY_SYMBOLS[state.currency]} {(portfolioSummary.value * EXCHANGE_RATES[state.currency]).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3></div>
        </div>
        <div className="glass-effect p-6 rounded-3xl border border-white/5 flex items-center gap-5">
           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${portfolioSummary.profit >= 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}><BarChart3 size={24} /></div>
           <div><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{t.totalProfit}</p><h3 className={`text-xl font-black font-mono ${portfolioSummary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{portfolioSummary.profit >= 0 ? '+' : ''}{CURRENCY_SYMBOLS[state.currency]} {(portfolioSummary.profit * EXCHANGE_RATES[state.currency]).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
           <FearGreedIndex value={fngData.stock.score} label={`STOCKS ${fngData.stock.label}`} isAnalyzing={fngData.loading} compact />
           <FearGreedIndex value={fngData.crypto.score} label={`CRYPTO ${fngData.crypto.label}`} isAnalyzing={fngData.loading} compact />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between bg-white/[0.02] p-5 rounded-3xl border border-white/5">
            <div className="flex flex-col">
              <div className="flex items-center gap-2"><h2 className="text-2xl font-bold">{activeSymbol}</h2>{!/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(activeSymbol) && !marketOpen && <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-bold">休市</span>}</div>
              <div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">{t.marketOverview}</span></div>
            </div>
            <div className="flex items-center gap-6">
              {prices[activeSymbol] && <PriceDisplay price={prices[activeSymbol].price} currencySymbol={CURRENCY_SYMBOLS[state.currency]} rate={EXCHANGE_RATES[state.currency]} change={prices[activeSymbol].change} isMarketClosed={!/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(activeSymbol) && !marketOpen} language={state.language} />}
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} /><input type="text" placeholder={t.placeholderSymbol} className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none w-48 text-sm uppercase font-mono" onKeyDown={(e) => { if (e.key === 'Enter') { const val = (e.target as HTMLInputElement).value.toUpperCase(); if (val) { if (!state.watchlist.includes(val)) setState(prev => ({ ...prev, watchlist: [...prev.watchlist, val] })); setActiveSymbol(val); } } }} /></div>
            </div>
          </div>
          <TradingViewWidget symbol={activeSymbol} />
        </div>
        <div className="glass-effect rounded-3xl p-6 border border-white/5 flex flex-col h-[600px]">
           <div className="flex items-center justify-between mb-6"><h3 className="text-xs font-bold opacity-60 uppercase tracking-widest">{t.watchlist}</h3><RefreshCw size={12} className="text-gray-500 animate-spin-slow" /></div>
           <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {state.watchlist.map(s => {
                const pData = prices[s]; const isActive = activeSymbol === s; 
                return (
                  <button key={s} onClick={() => setActiveSymbol(s)} className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group ${isActive ? 'bg-indigo-600 border-indigo-600 shadow-lg' : 'bg-white/5 border-white/10 hover:border-white/30'}`}>
                    <div className="text-left"><span className={`block font-black text-sm ${isActive ? 'text-white' : 'text-gray-200'}`}>{s}</span><span className={`text-[10px] font-bold ${isActive ? 'text-indigo-200' : (pData?.change >= 0 ? 'text-green-400' : 'text-red-400')}`}>{pData ? `${pData.change >= 0 ? '+' : ''}${pData.change.toFixed(2)}%` : '--'}</span></div>
                    <div className="text-right"><span className={`block font-mono text-xs font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>{pData ? (pData.price * EXCHANGE_RATES[state.currency]).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '...'}</span><div onClick={(e) => { e.stopPropagation(); setState(prev => ({ ...prev, watchlist: prev.watchlist.filter(w => w !== s) })); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded-md transition-all"><Trash2 size={12} /></div></div>
                  </button>
                );
              })}
           </div>
        </div>
      </div>
    </div>
  );
});

const Portfolio = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const t = TRANSLATIONS[state.language]; 
  const symbolIcon = CURRENCY_SYMBOLS[state.currency]; 
  const rate = EXCHANGE_RATES[state.currency];
  
  const [livePrices, setLivePrices] = useState<Record<string, number>>({}); 
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<PortfolioItem>>({ symbol: '', type: 'Stock', buyDate: new Date().toISOString().split('T')[0], cost: 0, quantity: 0 });

  // 匯總計算數據
  const aggregatedPortfolio = useMemo(() => {
    const groups: Record<string, { totalQty: number, totalCost: number, batches: PortfolioItem[] }> = {};
    state.portfolio.forEach(item => {
      if (!groups[item.symbol]) groups[item.symbol] = { totalQty: 0, totalCost: 0, batches: [] };
      groups[item.symbol].totalQty += item.quantity;
      groups[item.symbol].totalCost += (item.cost * item.quantity);
      groups[item.symbol].batches.push(item);
    });
    return Object.entries(groups).map(([sym, data]) => ({
      symbol: sym,
      avgCost: data.totalQty > 0 ? data.totalCost / data.totalQty : 0,
      totalQty: data.totalQty,
      batches: data.batches.sort((a,b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime())
    }));
  }, [state.portfolio]);

  const fetchPortfolioPrices = useCallback(async () => {
    if (state.portfolio.length === 0) return;
    const symbolsToFetch = Array.from(new Set(state.portfolio.map(item => item.symbol)));
    const results: Record<string, number> = {};
    await Promise.all(symbolsToFetch.map(async (s) => {
      try {
        if (/USDT$|USDC$|BUSD$|BTC$|ETH$/.test(s)) { 
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`); 
          const data = await res.json(); if (data.price) results[s] = parseFloat(data.price); 
        } else {
          const proxyUrl = "https://corsproxy.io/?";
          const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1m&range=1d`;
          const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
          const data = await response.json();
          if (data.chart?.result?.[0]?.meta) results[s] = data.chart.result[0].meta.regularMarketPrice;
          else results[s] = STOCK_BASE_PRICES[s] || 0;
        }
      } catch (e) { results[s] = STOCK_BASE_PRICES[s] || 0; }
    }));
    setLivePrices(prev => ({ ...prev, ...results }));
  }, [state.portfolio]);

  useEffect(() => { fetchPortfolioPrices(); const interval = setInterval(fetchPortfolioPrices, 30000); return () => clearInterval(interval); }, [fetchPortfolioPrices]);

  const handleSave = () => {
    if (!newItem.symbol || !newItem.cost || !newItem.quantity) return;
    setState(prev => {
      let updated;
      if (editingId) {
        updated = prev.portfolio.map(p => p.id === editingId ? { ...p, ...newItem } as PortfolioItem : p);
      } else {
        updated = [...prev.portfolio, { ...newItem as PortfolioItem, id: Date.now().toString() }];
      }
      localStorage.setItem('portfolio', JSON.stringify(updated));
      return { ...prev, portfolio: updated };
    });
    setIsAdding(false);
    setEditingId(null);
    setNewItem({ symbol: '', type: 'Stock', buyDate: new Date().toISOString().split('T')[0], cost: 0, quantity: 0 });
  };

  const handleEdit = (item: PortfolioItem) => {
    setNewItem(item);
    setEditingId(item.id);
    setIsAdding(true);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div><h2 className="text-3xl font-bold">{t.portfolio}</h2><p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Manage multiple entry batches and average costs</p></div>
        <button onClick={() => { setEditingId(null); setIsAdding(true); }} className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-xl shadow-indigo-600/20 transition-all active:scale-95"><Plus size={20} /> {t.addPortfolio}</button>
      </div>
      
      {/* 編輯/新增彈窗 */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="glass-effect p-10 rounded-[2.5rem] w-full max-w-lg space-y-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black">{editingId ? '編輯資產' : t.addPortfolio}</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <label className="col-span-2 space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.symbol}</span>
                <input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none uppercase font-mono text-xl font-bold focus:border-indigo-500 transition-all" placeholder="E.G. NVDA" value={newItem.symbol} onChange={e => setNewItem({...newItem, symbol: e.target.value.toUpperCase()})} />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.cost}</span>
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none font-mono text-xl focus:border-indigo-500" value={newItem.cost || ''} onChange={e => setNewItem({...newItem, cost: Number(e.target.value)})} />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.quantity}</span>
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none font-mono text-xl focus:border-indigo-500" value={newItem.quantity || ''} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
              </label>
              <label className="col-span-2 space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.date}</span>
                <input type="date" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none font-mono focus:border-indigo-500" value={newItem.buyDate} onChange={e => setNewItem({...newItem, buyDate: e.target.value})} />
              </label>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={handleSave} className="flex-1 bg-indigo-600 py-5 rounded-3xl font-black text-lg shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all">確認儲存</button>
            </div>
          </div>
        </div>
      )}

      {/* 資產匯總卡片區域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {aggregatedPortfolio.map(group => {
          const livePrice = livePrices[group.symbol] || group.avgCost;
          const totalProfit = (livePrice - group.avgCost) * group.totalQty;
          const isProfit = totalProfit >= 0;
          return (
            <div key={group.symbol} className="glass-effect p-8 rounded-[2rem] border border-white/10 space-y-6 group/card hover:border-indigo-500/30 transition-all">
              <div className="flex justify-between items-start">
                <div><h4 className="text-2xl font-black tracking-tighter">{group.symbol}</h4><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Aggregate Holdings</p></div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black ${isProfit ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {((livePrice - group.avgCost) / group.avgCost * 100).toFixed(2)}%
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-1">平均成本</p><p className="font-mono text-lg font-bold">{symbolIcon} {(group.avgCost * rate).toLocaleString(undefined, {maximumFractionDigits: 2})}</p></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-1">總持有量</p><p className="font-mono text-lg font-bold">{group.totalQty.toLocaleString()}</p></div>
                <div className="col-span-2 pt-2 border-t border-white/5"><p className="text-[10px] text-gray-500 font-bold uppercase mb-1">預估總盈虧</p><p className={`font-mono text-2xl font-black ${isProfit ? 'text-green-400' : 'text-red-400'}`}>{isProfit ? '+' : ''}{symbolIcon} {(totalProfit * rate).toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 詳細批次交易列表 */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 px-2"><Activity size={18} className="text-indigo-400" /> 交易明細 (Batches)</h3>
        <div className="glass-effect rounded-[2rem] overflow-hidden border border-white/5">
          <table className="w-full text-left">
            <thead className="bg-white/[0.03] border-b border-white/5 text-[10px] uppercase tracking-widest opacity-60 font-black">
              <tr>
                <th className="px-8 py-5">買入日期</th>
                <th className="px-8 py-5">商品</th>
                <th className="px-8 py-5 text-right">買入成本</th>
                <th className="px-8 py-5 text-right">數量</th>
                <th className="px-8 py-5 text-right">目前獲利</th>
                <th className="px-8 py-5 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aggregatedPortfolio.map(group => group.batches.map(item => {
                const livePrice = livePrices[item.symbol] || item.cost;
                const batchProfit = (livePrice - item.cost) * item.quantity;
                return (
                  <tr key={item.id} className="group/row hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-6 font-mono text-gray-400 text-xs">{item.buyDate}</td>
                    <td className="px-8 py-6 font-black uppercase text-sm">{item.symbol}</td>
                    <td className="px-8 py-6 font-mono text-right font-bold text-sm">{symbolIcon} {(item.cost * rate).toLocaleString()}</td>
                    <td className="px-8 py-6 font-mono text-right opacity-60 text-sm">{item.quantity.toLocaleString()}</td>
                    <td className={`px-8 py-6 font-mono font-black text-right text-sm ${batchProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {batchProfit >= 0 ? '+' : ''}{symbolIcon} {(batchProfit * rate).toLocaleString()}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(item)} className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-xl"><Edit3 size={16} /></button>
                        <button onClick={() => setState(prev => ({ ...prev, portfolio: prev.portfolio.filter(p => p.id !== item.id) }))} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
          {state.portfolio.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center opacity-30 gap-4"><Wallet size={48} /><p className="font-bold">尚未加入任何資產明細</p></div>
          )}
        </div>
      </div>
    </div>
  );
});

const Settings = memo(({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const t = TRANSLATIONS[state.language];
  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold">{t.settings}</h2>
      <div className="glass-effect rounded-[2.5rem] p-10 space-y-10 border border-white/5">
        <div className="flex items-center justify-between">
          <div><h4 className="font-bold text-lg">{t.lang}</h4><p className="text-sm text-gray-500">切換應用介面顯示語言</p></div>
          <select value={state.language} onChange={(e) => setState(prev => ({...prev, language: e.target.value as Language}))} className="bg-neutral-900 border border-white/10 rounded-xl p-4 outline-none cursor-pointer focus:border-indigo-500">
            <option value="en">English (US)</option>
            <option value="zh-TW">繁體中文 (Taiwan)</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div><h4 className="font-bold text-lg">{t.currency}</h4><p className="text-sm text-gray-500">所有資產將以此幣別計算顯示</p></div>
          <select value={state.currency} onChange={(e) => setState(prev => ({...prev, currency: e.target.value as Currency}))} className="bg-neutral-900 border border-white/10 rounded-xl p-4 outline-none cursor-pointer focus:border-indigo-500">
            <option value="USD">USD ($)</option>
            <option value="TWD">TWD (NT$)</option>
            <option value="MYR">MYR (RM)</option>
          </select>
        </div>
      </div>
    </div>
  );
});

const App = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#050505] text-white flex selection:bg-indigo-500/30">
        <Sidebar language={state.language} />
        <main className="flex-1 ml-64 p-10 min-h-screen relative overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard state={state} setState={setState} />} />
            <Route path="/portfolio" element={<Portfolio state={state} setState={setState} />} />
            <Route path="/settings" element={<Settings state={state} setState={setState} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
