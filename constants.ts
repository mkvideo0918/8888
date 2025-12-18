
import { Language, Currency } from './types';

export const TRANSLATIONS: Record<Language, any> = {
  'en': {
    dashboard: 'Dashboard',
    watchlist: 'Watchlist',
    portfolio: 'Portfolio',
    history: 'Analysis History',
    settings: 'Settings',
    aiAnalyst: 'AI Master Analyst',
    fearGreed: 'Fear & Greed Index',
    marketOverview: 'Market Overview',
    analyze: 'Deep AI Analysis',
    addPortfolio: 'Add to Portfolio',
    cost: 'Cost',
    currentPrice: 'Price',
    profit: 'Profit/Loss',
    plRatio: 'P/L Ratio',
    symbol: 'Symbol',
    date: 'Buy Date',
    quantity: 'Quantity',
    save: 'Save',
    cancel: 'Cancel',
    thinking: 'AI is analyzing market signals...',
    currency: 'Currency',
    lang: 'Language',
    placeholderSymbol: 'e.g. AAPL, BTCUSDT',
    detailedAnalysis: 'Master AI Report',
  },
  'zh-TW': {
    dashboard: '儀表板',
    watchlist: '關注名單',
    portfolio: '投資組合',
    history: '分析歷史',
    settings: '設定',
    aiAnalyst: 'AI 大師詳細分析',
    fearGreed: '市場恐慌貪婪指數',
    marketOverview: '市場概覽',
    analyze: 'AI 深度分析',
    addPortfolio: '加入投資組合',
    cost: '成本',
    currentPrice: '目前價格',
    profit: '盈虧',
    plRatio: '盈虧比',
    symbol: '代碼',
    date: '買入時間',
    quantity: '數量',
    save: '儲存',
    cancel: '取消',
    thinking: 'AI 正在分析市場信號...',
    currency: '貨幣',
    lang: '語言',
    placeholderSymbol: '例如 AAPL, BTCUSDT',
    detailedAnalysis: 'AI 大師詳細報告',
  }
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  TWD: 'NT$',
  MYR: 'RM'
};

export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  TWD: 32.5,
  MYR: 4.7
};
