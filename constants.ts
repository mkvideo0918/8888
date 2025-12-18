
import { Language, Currency } from './types';

export const TRANSLATIONS: Record<Language, any> = {
  'en': {
    dashboard: 'Live Markets',
    watchlist: 'My Watchlist',
    portfolio: 'Portfolio Manager',
    settings: 'Preferences',
    fearGreed: 'Market Sentiment',
    marketOverview: 'Market Overview',
    addPortfolio: 'Add Asset',
    cost: 'Entry Cost',
    currentPrice: 'Market Price',
    profit: 'Profit / Loss',
    plRatio: 'P/L %',
    symbol: 'Ticker',
    date: 'Purchase Date',
    quantity: 'Holdings',
    save: 'Confirm',
    cancel: 'Discard',
    delete: 'Remove',
    actions: 'Manage',
    currency: 'Base Currency',
    lang: 'App Language',
    placeholderSymbol: 'Search e.g. BTCUSDT, CRCL, NVDA',
    prevClose: 'Prev. Close',
    marketClosed: 'Market Closed',
    totalValue: 'Total Portfolio Value',
    totalProfit: 'Total Unrealized P/L',
    aiAnalysis: 'AI Master Insight',
    analyzing: 'Master is thinking...',
    marketType: 'Market Type',
    avgCost: 'Entry Price',
    totalHoldings: 'Total Holdings',
    totalCost: 'Total Invested',
    marketValue: 'Market Value'
  },
  'zh-TW': {
    dashboard: '實時行情',
    watchlist: '關注名單',
    portfolio: '資產管理',
    settings: '個人設定',
    fearGreed: '市場情緒指標',
    marketOverview: '市場概覽',
    addPortfolio: '新增資產',
    cost: '入場價',
    currentPrice: '目前市價',
    profit: '預估盈虧',
    plRatio: '報酬率',
    symbol: '商品代碼',
    date: '買入日期',
    quantity: '持有數量',
    save: '確認儲存',
    cancel: '取消',
    delete: '刪除紀錄',
    actions: '操作',
    currency: '顯示幣別',
    lang: '顯示語言',
    placeholderSymbol: '搜尋代碼，如 BTCUSDT, CRCL, NVDA',
    prevClose: '昨日收盤',
    marketClosed: '美股休市中',
    totalValue: '資產總市值',
    totalProfit: '總未實現盈虧',
    aiAnalysis: 'AI 大師深度分析',
    analyzing: '大師正在觀測盤勢...',
    marketType: '市場分類',
    avgCost: '平均成本',
    totalHoldings: '持有數量',
    totalCost: '投資本金',
    marketValue: '當前市值'
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
  MYR: 4.45
};
