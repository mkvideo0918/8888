
import React, { useEffect, useRef } from 'react';

interface Props {
  symbol: string;
}

declare const TradingView: any;

const TradingViewWidget: React.FC<Props> = ({ symbol }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current && typeof TradingView !== 'undefined') {
      new TradingView.widget({
        width: '100%',
        height: '500',
        symbol: symbol.includes('/') ? symbol.replace('/', '') : symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#f1f3f6',
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: container.current.id,
      });
    }
  }, [symbol]);

  return (
    <div className="w-full rounded-xl overflow-hidden glass-effect">
      <div id={`tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '')}`} ref={container} />
    </div>
  );
};

export default TradingViewWidget;
