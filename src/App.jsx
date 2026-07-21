import { useState, useEffect } from "react";
import AccessGate from "./components/AccessGate";
import TradingViewChart from "./components/TradingViewChart";
import ScanButton from "./components/ScanButton";
import SignalResult from "./components/SignalResult";
import { initTelegramApp } from "./telegram";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://your-bot.up.railway.app";
const STORAGE_KEY = "qx_active_signal";

const AVAILABLE_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "USD/CAD", "AUD/USD", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "EUR/AUD",
  "AUD/JPY", "CAD/JPY", "EUR/CAD", "GBP/CAD",
  "CHF/JPY", "EUR/CHF", "GBP/CHF", "AUD/CAD", "NZD/JPY",
];

function loadPersistedSignal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const closeEpoch = parsed.entryEpoch + 60000;
    // ক্লোজ টাইমের পর কিছু বাফার সময় গেলে আর restore করা হবে না
    if (Date.now() > closeEpoch + 5000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

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
  const [activeSignal, setActiveSignal] = useState(() => loadPersistedSignal());

  function handleStart(signal) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signal));
    setActiveSignal(signal);
  }

  function handleDone() {
    localStorage.removeItem(STORAGE_KEY);
    setActiveSignal(null);
  }

  return (
    <div style={{ color: "white", fontFamily: "system-ui, sans-serif", minHeight: "100vh", backgroundColor: "#0d0f14" }}>
      <TradingViewChart pair={activeSignal ? activeSignal.pair : pair} />

      <div style={{ padding: 16 }}>
        <label style={{ color: "#9aa3b2", fontSize: 13, display: "block", marginBottom: 6 }}>
          Select Pair
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

        <ScanButton pair={pair} disabled={!!activeSignal} onStart={handleStart} />

        {activeSignal && (
          <SignalResult
            apiBaseUrl={apiBaseUrl}
            pair={activeSignal.pair}
            entryEpoch={activeSignal.entryEpoch}
            revealEpoch={activeSignal.revealEpoch}
            onDone={handleDone}
          />
        )}
      </div>
    </div>
  );
}
