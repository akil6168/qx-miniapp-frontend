import { useState, useEffect } from "react";
import AccessGate from "./components/AccessGate";
import TradingViewChart from "./components/TradingViewChart";
import ScanButton from "./components/ScanButton";
import SignalResult from "./components/SignalResult";
import { initTelegramApp } from "./telegram";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://your-bot.up.railway.app";

const AVAILABLE_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "USD/CAD", "AUD/USD", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "EUR/AUD",
  "AUD/JPY", "CAD/JPY", "EUR/CAD", "GBP/CAD",
  "CHF/JPY", "EUR/CHF", "GBP/CHF", "AUD/CAD", "NZD/JPY",
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
  const [activeSignal, setActiveSignal] = useState(null);

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
          disabled={!!activeSignal}
          style={{ width: "100%", padding: "10px", marginBottom: "16px", backgroundColor: "#12151c", color: "#fff", border: "1px solid #232838", borderRadius: "10px", fontSize: "14px" }}
        >
          {AVAILABLE_PAIRS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <ScanButton pair={pair} disabled={!!activeSignal} onStart={setActiveSignal} />

        {activeSignal && (
          <SignalResult
            apiBaseUrl={apiBaseUrl}
            pair={activeSignal.pair}
            entryEpoch={activeSignal.entryEpoch}
            revealEpoch={activeSignal.revealEpoch}
            onDone={() => setActiveSignal(null)}
          />
        )}
      </div>
    </div>
  );
}
