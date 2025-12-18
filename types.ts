
export type Language = 'en' | 'zh-TW';
export type Currency = 'USD' | 'TWD' | 'MYR';
export type AssetMarket = 'US' | 'Crypto' | 'TW' | 'MY' | 'HK';

export interface PortfolioItem {
  id: string;
  symbol: string;
  market: AssetMarket;
  type: 'Stock' | 'Crypto';
  buyDate: string;
  cost: number;
  quantity: number;
}

export interface Account {
  id: string;
  name: string;
  password?: string;
  portfolio: PortfolioItem[];
  watchlist: string[];
  currency: Currency;
  language: Language;
  assetOrder?: string[]; // 儲存資產代碼的排序順序
}

export interface AppState {
  accounts: Account[];
  activeAccountId: string;
  privacyMode: boolean;
}
