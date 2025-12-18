
import React, { useEffect, useRef, memo } from 'react';

interface Props {
  symbol: string;
}

declare const TradingView: any;

const TradingViewWidget: React.FC<Props> = ({ symbol }) => {
  const container = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    const containerId = `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    // 清理舊的 widget 實例
    if (container.current) {
      container.current.innerHTML = `<div id="${containerId}" style="height: 500px; width: 100%;"></div>`;
    }

    if (typeof TradingView !== 'undefined') {
      try {
        widgetRef.current = new TradingView.widget({
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
          hide_top_toolbar: false,
          save_image: false,
          container_id: containerId,
        });
      } catch (e) {
        console.error("TradingView initialization failed:", e);
      }
    }

    return () => {
      // 組件卸載或 symbol 改變時的清理
      if (widgetRef.current) {
        widgetRef.current = null;
      }
    };
  }, [symbol]);

  return (
    <div className="w-full rounded-xl overflow-hidden glass-effect border border-white/5 shadow-2xl">
      <div ref={container} className="w-full h-[500px]" />
    </div>
  );
};

// 使用 memo 防止父組件無關更新導致重新渲染
export default memo(TradingViewWidget);
