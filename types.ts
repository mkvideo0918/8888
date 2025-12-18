
export type Language = 'en' | 'zh-TW';
export type Currency = 'USD' | 'TWD' | 'MYR';

export interface PortfolioItem {
  id: string;
  symbol: string;
  type: 'Stock' | 'Crypto';
  buyDate: string;
  cost: number;
  quantity: number;
  currentPrice?: number;
}

export interface AnalysisHistory {
  id: string;
  symbol: string;
  timestamp: number;
  summary: string;
  recommendation: 'Buy' | 'Hold' | 'Sell' | 'Neutral';
  detailedAnalysis: string;
}

export interface AppState {
  language: Language;
  currency: Currency;
  portfolio: PortfolioItem[];
  history: AnalysisHistory[];
  watchlist: string[];
}
