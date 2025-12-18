
import React, { useEffect, useRef, memo } from 'react';

interface Props {
  symbol: string;
}

declare const TradingView: any;

const TradingViewWidget: React.FC<Props> = ({ symbol }) => {
  const container = useRef<HTMLDivElement>(null);
  const currentSymbolRef = useRef<string>('');

  useEffect(() => {
    if (currentSymbolRef.current === symbol) return;
    currentSymbolRef.current = symbol;

    const containerId = `tv_chart_${Math.random().toString(36).substring(7)}`;
    
    if (container.current) {
      container.current.innerHTML = `<div id="${containerId}" style="height: 500px; width: 100%;"></div>`;
    }

    const formatSymbol = (s: string) => {
      // 如果已經包含冒號，直接返回
      if (s.includes(':')) return s;
      
      // 判定是否為加密貨幣
      const isCrypto = /USDT$|USDC$|BUSD$|BTC$|ETH$/.test(s);
      if (isCrypto) return `BINANCE:${s}`;
      
      // 判定是否為熱門美股，否則預設 NASDAQ
      const nyseStocks = ['TSLA', 'NIO', 'XPEV', 'AMC', 'GME']; // 範例
      if (nyseStocks.includes(s)) return `NYSE:${s}`;
      
      return `NASDAQ:${s}`;
    };

    const initWidget = () => {
      if (typeof TradingView !== 'undefined' && container.current) {
        new TradingView.widget({
          autosize: true,
          symbol: formatSymbol(symbol),
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'zh_TW',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: containerId,
          withdateranges: true,
          hide_volume: false,
          show_popup_button: true,
          popup_width: "1000",
          popup_height: "650"
        });
      }
    };

    const timer = setTimeout(initWidget, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [symbol]);

  return (
    <div className="w-full rounded-2xl overflow-hidden glass-effect border border-white/10 shadow-2xl h-[500px]">
      <div ref={container} className="w-full h-full" />
    </div>
  );
};

export default memo(TradingViewWidget);
