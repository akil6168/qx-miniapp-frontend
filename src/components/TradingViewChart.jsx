import { useEffect, useRef } from "react";

function toTradingViewSymbol(pair) {
  const cleaned = pair.replace(' OTC', '').replace('/', '');
  const exoticQuotes = ['PKR', 'INR', 'BDT', 'IDR'];
  const isExotic = exoticQuotes.some(q => pair.includes(q));
  return isExotic ? `FX_IDC:${cleaned}` : `FX:${cleaned}`;
}

export default function TradingViewChart({ pair }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: toTradingViewSymbol(pair),
      interval: "1",
      timezone: "Asia/Dhaka",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(13, 15, 20, 1)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      support_host: "https://www.tradingview.com",
    });

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    wrapper.appendChild(widgetDiv);
    wrapper.appendChild(script);

    containerRef.current.appendChild(wrapper);
  }, [pair]);

  return (
    <div
      ref={containerRef}
      style={{ height: "360px", width: "100%", backgroundColor: "#0d0f14" }}
    />
  );
}
