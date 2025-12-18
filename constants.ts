
import { Language, Currency } from './types';

export const TRANSLATIONS: Record<Language, any> = {
  'en': {
    dashboard: 'Dashboard',
    watchlist: 'Watchlist',
    portfolio: 'Portfolio',
    settings: 'Settings',
    accounts: 'Accounts',
    addAccount: 'New Account',
    accountName: 'Account Name',
    password: 'Password (Optional)',
    enterPassword: 'Enter Password to Unlock',
    hideAmounts: 'Privacy Mode',
    showAmounts: 'Show Amounts',
    marketValue: 'Market Value',
    totalCost: 'Total Invested',
    profit: 'Profit/Loss',
    avgCost: 'Entry Price',
    currentPrice: 'Market Price',
    symbol: 'Symbol',
    addPortfolio: 'Add Asset',
    cost: 'Entry Cost',
    quantity: 'Quantity',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    placeholderSymbol: 'e.g. BTCUSDT, CRCL, NVDA',
    marketClosed: 'Market Closed',
    totalValue: 'Total Balance',
    totalProfit: 'Total P/L',
    aiAnalysis: 'AI Analysis',
    analyzing: 'Analyzing...',
    unlock: 'Unlock Account',
    privacyOn: 'Amounts Hidden',
    privacyOff: 'Amounts Shown'
  },
  'zh-TW': {
    dashboard: '主控制台',
    watchlist: '關注名單',
    portfolio: '資產管理',
    settings: '個人設定',
    accounts: '帳戶管理',
    addAccount: '新增帳戶',
    accountName: '帳戶名稱',
    password: '帳戶密碼 (選填)',
    enterPassword: '請輸入密碼解鎖',
    hideAmounts: '隱私模式',
    showAmounts: '顯示金額',
    marketValue: '當前市值',
    totalCost: '投資本金',
    profit: '預估盈虧',
    avgCost: '入場平均價',
    currentPrice: '目前市價',
    symbol: '商品代碼',
    addPortfolio: '新增資產',
    cost: '入場價',
    quantity: '數量',
    save: '儲存',
    cancel: '取消',
    delete: '刪除',
    placeholderSymbol: '搜尋代碼，如 BTCUSDT, CRCL, NVDA',
    marketClosed: '休市',
    totalValue: '資產總計',
    totalProfit: '總盈虧',
    aiAnalysis: 'AI 大師分析',
    analyzing: '分析中...',
    unlock: '解鎖帳戶',
    privacyOn: '已隱藏金額',
    privacyOff: '顯示金額'
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
