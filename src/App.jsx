import { useEffect, useState } from "react";
import AccessGate from "./components/AccessGate";
import TradingViewChart from "./components/TradingViewChart";
import ScanButton from "./components/ScanButton";
import SignalResult from "./components/SignalResult";
import { initTelegramApp } from "./telegram";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://your-bot.up.railway.app";

const AVAILABLE_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "EUR/JPY", "GBP/JPY",
];

export default function App() {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return (
    <AccessGate apiBaseUrl={API_BASE_URL}>
      <MainScreen apiBaseUrl={API_BASE_URL} />
    </AccessGate>
  );
}

function MainScreen({ apiBaseUrl }) {
  const [pair, setPair] = useState("EUR/USD");
  const [result, setResult] = useState(null);

  return (
    <div style={{ color: "white", fontFamily: "system-ui, sans-serif", minHeight: "100vh", backgroundColor: "#0d0f14" }}>
      <TradingViewChart pair={pair} />

      <div style={{ padding: 16 }}>
        <label style={{ color: "#9aa3b2", fontSize: 13, display: "block", marginBottom: 6 }}>
          পেয়ার বাছাই করুন
        </label>
        <select
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "16px",
            backgroundColor: "#12151c",
            color: "#fff",
            border: "1px solid #232838",
            borderRadius: "10px",
            fontSize: "14px",
          }}
        >
          {AVAILABLE_PAIRS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <ScanButton apiBaseUrl={apiBaseUrl} pair={pair} onResult={setResult} />
      </div>

      <SignalResult result={result} onClose={() => setResult(null)} />
    </div>
  );
}
