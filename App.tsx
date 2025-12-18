
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wallet, 
  // Rename to avoid conflict with the History component below
  History as HistoryIcon, 
  Settings as SettingsIcon, 
  Search, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Info
} from 'lucide-react';
import { AppState, Language, Currency, PortfolioItem, AnalysisHistory } from './types.ts';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants.ts';
import TradingViewWidget from './components/TradingViewWidget.tsx';
import FearGreedIndex from './components/FearGreedIndex.tsx';
import { analyzeMarket } from './services/geminiService.ts';

const INITIAL_STATE: AppState = {
  language: 'zh-TW',
  currency: 'TWD',
  portfolio: JSON.parse(localStorage.getItem('portfolio') || '[]'),
  history: JSON.parse(localStorage.getItem('history') || '[]'),
  watchlist: ['BTCUSDT', 'AAPL', 'NVDA', 'ETHUSDT'],
};

const Sidebar = ({ language }: { language: Language }) => {
  const t = TRANSLATIONS[language];
  const location = useLocation();
  const menuItems = [
    { name: t.dashboard, path: '/', icon: LayoutDashboard },
    { name: t.portfolio, path: '/portfolio', icon: Wallet },
    // Use renamed HistoryIcon
    { name: t.history, path: '/history', icon: HistoryIcon },
    { name: t.settings, path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="w-64 h-screen fixed left-0 top-0 glass-effect border-r border-white/10 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">WealthWise</h1>
      </div>
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                  : 'hover:bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 glass-effect rounded-2xl text-[10px] text-gray-500 uppercase tracking-widest text-center">
        AI-Powered Insight Engine
      </div>
    </div>
  );
};

const Dashboard = ({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const [activeSymbol, setActiveSymbol] = useState(state.watchlist[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const t = TRANSLATIONS[state.language];

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeMarket(activeSymbol, state.language);
      setCurrentAnalysis(result);
      const newHistory: AnalysisHistory = {
        id: Date.now().toString(),
        symbol: activeSymbol,
        timestamp: Date.now(),
        ...result
      };
      const updatedHistory = [newHistory, ...state.history].slice(0, 50);
      setState(prev => ({ ...prev, history: updatedHistory }));
      localStorage.setItem('history', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-blue-500">●</span> {activeSymbol} {t.marketOverview}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder={t.placeholderSymbol}
                className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-48 transition-all focus:w-64"
                onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.toUpperCase();
                      if (val) setActiveSymbol(val);
                      (e.target as HTMLInputElement).value = '';
                   }
                }}
              />
            </div>
          </div>
          <TradingViewWidget symbol={activeSymbol} />
        </div>
        <div className="space-y-6">
          <FearGreedIndex value={65} label="Greed" />
          <div className="glass-effect p-6 rounded-2xl flex flex-col min-h-[400px]">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Info size={18} className="text-blue-400" />
              {t.aiAnalyst}
            </h3>
            {isAnalyzing ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 animate-pulse">{t.thinking}</p>
              </div>
            ) : currentAnalysis ? (
              <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  currentAnalysis.recommendation === 'Buy' ? 'bg-green-500/20 text-green-400' :
                  currentAnalysis.recommendation === 'Sell' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {currentAnalysis.recommendation}
                </div>
                <p className="text-sm font-medium leading-relaxed">{currentAnalysis.summary}</p>
                <div className="h-px bg-white/10" />
                <div className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {currentAnalysis.detailedAnalysis}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                <Search className="w-12 h-12 mb-2" />
                <p className="text-sm">點擊下方按鈕開始 AI 深度分析</p>
              </div>
            )}
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <TrendingUp size={20} />
              {t.analyze}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-effect rounded-2xl p-6">
         <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest mb-4">{t.watchlist}</h3>
         <div className="flex flex-wrap gap-3">
            {state.watchlist.map(s => (
              <button 
                key={s} 
                onClick={() => setActiveSymbol(s)}
                className={`px-5 py-2 rounded-xl transition-all border ${activeSymbol === s ? 'bg-blue-600 border-blue-600 text-white' : 'border-white/10 hover:border-white/30 bg-white/5'}`}
              >
                {s}
              </button>
            ))}
         </div>
      </div>
    </div>
  );
};

const Portfolio = ({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const t = TRANSLATIONS[state.language];
  const symbol = CURRENCY_SYMBOLS[state.currency];
  const rate = EXCHANGE_RATES[state.currency];

  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PortfolioItem>>({
    symbol: '',
    type: 'Stock',
    buyDate: new Date().toISOString().split('T')[0],
    cost: 0,
    quantity: 0
  });

  const handleAdd = () => {
    if (!newItem.symbol || !newItem.cost) return;
    const item: PortfolioItem = {
      ...newItem as PortfolioItem,
      id: Date.now().toString(),
    };
    const updated = [...state.portfolio, item];
    setState(prev => ({ ...prev, portfolio: updated }));
    localStorage.setItem('portfolio', JSON.stringify(updated));
    setIsAdding(false);
  };

  const calculatePL = (item: PortfolioItem) => {
    const currentPrice = item.cost * (1 + (Math.random() * 0.2 - 0.1));
    const profit = (currentPrice - item.cost) * item.quantity;
    const ratio = ((currentPrice - item.cost) / item.cost) * 100;
    return { profit, ratio, currentPrice };
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{t.portfolio}</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={20} /> {t.addPortfolio}
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-effect p-8 rounded-3xl w-full max-w-md space-y-6 shadow-2xl border border-white/20">
            <h3 className="text-xl font-bold">{t.addPortfolio}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t.symbol}</label>
                <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.symbol} onChange={e => setNewItem({...newItem, symbol: e.target.value.toUpperCase()})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t.cost} (USD)</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.cost} onChange={e => setNewItem({...newItem, cost: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t.quantity}</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t.date}</label>
                <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.buyDate} onChange={e => setNewItem({...newItem, buyDate: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleAdd} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold">確認</button>
              <button onClick={() => setIsAdding(false)} className="flex-1 bg-white/10 py-3 rounded-xl font-bold">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-effect rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest opacity-60">{t.symbol}</th>
              <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest opacity-60">{t.cost}</th>
              <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest opacity-60">{t.currentPrice}</th>
              <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest opacity-60">{t.profit}</th>
              <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest opacity-60">{t.plRatio}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {state.portfolio.map(item => {
              const { profit, ratio, currentPrice } = calculatePL(item);
              const isProfit = profit >= 0;
              return (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-6">
                    <div className="font-bold">{item.symbol}</div>
                    <div className="text-[10px] text-gray-500">{item.buyDate}</div>
                  </td>
                  <td className="px-6 py-6 font-mono text-sm">
                    {symbol} {(item.cost * rate).toLocaleString()}
                  </td>
                  <td className="px-6 py-6 font-mono text-sm text-gray-400">
                    {symbol} {(currentPrice * rate).toLocaleString()}
                  </td>
                  <td className={`px-6 py-6 font-mono text-sm font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''} {(profit * rate).toLocaleString()}
                  </td>
                  <td className={`px-6 py-6`}>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${isProfit ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {isProfit ? <TrendingUp size={10} className="inline mr-1" /> : <TrendingDown size={10} className="inline mr-1" />}
                      {ratio.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {state.portfolio.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-gray-500 italic">
                  目前還沒有投資項目
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Settings = ({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) => {
  const t = TRANSLATIONS[state.language];

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold">{t.settings}</h2>
      <div className="glass-effect rounded-3xl p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-lg">{t.lang}</h4>
            <p className="text-sm text-gray-500">選擇您的介面顯示語言</p>
          </div>
          <select 
            value={state.language}
            onChange={(e) => setState({...state, language: e.target.value as Language})}
            className="bg-neutral-900 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            <option value="en">English</option>
            <option value="zh-TW">繁體中文</option>
          </select>
        </div>

        <div className="h-px bg-white/5" />

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-lg">{t.currency}</h4>
            <p className="text-sm text-gray-500">選擇報告與組合的顯示幣別</p>
          </div>
          <select 
            value={state.currency}
            onChange={(e) => setState({...state, currency: e.target.value as Currency})}
            className="bg-neutral-900 border border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            <option value="USD">USD ($)</option>
            <option value="TWD">TWD (NT$)</option>
            <option value="MYR">MYR (RM)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

const History = ({ state }: { state: AppState }) => {
  const t = TRANSLATIONS[state.language];
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold">{t.history}</h2>
      <div className="grid gap-6">
        {state.history.map(h => (
          <div key={h.id} className="glass-effect p-6 rounded-2xl space-y-4 hover:border-white/30 transition-all group cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-xl font-bold">{h.symbol}</span>
                <div className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">
                   {new Date(h.timestamp).toLocaleString()}
                </div>
              </div>
              <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest ${
                h.recommendation === 'Buy' ? 'bg-green-500/20 text-green-400' :
                h.recommendation === 'Sell' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {h.recommendation}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-200">{h.summary}</p>
            <div className="text-xs text-gray-400 leading-relaxed overflow-hidden group-hover:max-h-[1000px] max-h-12 transition-all duration-500 border-l-2 border-white/5 pl-4 italic">
              {h.detailedAnalysis}
            </div>
          </div>
        ))}
        {state.history.length === 0 && (
           <div className="text-center py-20 text-gray-500 italic">暫無分析歷史紀錄。</div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex">
        <Sidebar language={state.language} />
        <main className="flex-1 ml-64 p-8 min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard state={state} setState={setState} />} />
            <Route path="/portfolio" element={<Portfolio state={state} setState={setState} />} />
            <Route path="/history" element={<History state={state} />} />
            <Route path="/settings" element={<Settings state={state} setState={setState} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
