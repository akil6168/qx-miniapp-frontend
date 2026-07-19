import { useEffect, useRef, useState } from "react";
import { getInitData } from "../telegram";

const SCAN_STEPS = [
  "📊 Analyzing Price Action...",
  "📈 Checking Trend & Momentum...",
  "🔍 Evaluating Momentum Indicators...",
  "🌊 Analyzing Volatility Patterns...",
  "🎯 Calculating Probability...",
];

export default function ScanButton({ apiBaseUrl, pair, onResult }) {
  const [scanning, setScanning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimerRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(stepTimerRef.current);
  }, []);

  async function handleScan() {
    setScanning(true);
    setStepIndex(0);

    stepTimerRef.current = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, SCAN_STEPS.length - 1));
    }, 900);

    try {
      const initData = getInitData();
      const res = await fetch(`${apiBaseUrl}/miniapp/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, symbol: pair }),
      });
      const data = await res.json();

      const elapsedMinimum = new Promise((r) => setTimeout(r, 3000));
      await elapsedMinimum;

      onResult(data);
    } catch (err) {
      console.error("Scan failed:", err);
      onResult({ signal: false, reason: "NETWORK_ERROR" });
    } finally {
      clearInterval(stepTimerRef.current);
      setScanning(false);
    }
  }

  return (
    <>
      <button onClick={handleScan} disabled={scanning} style={styles.button}>
        {scanning ? "স্ক্যান হচ্ছে..." : "🔍 Scan Market"}
      </button>

      {scanning && (
        <div style={styles.overlay}>
          <div style={styles.card}>
            <div style={styles.spinnerRing}>
              <div style={styles.spinnerCore} />
            </div>
            <p style={styles.pairLabel}>{pair} · 1 Minute</p>
            <p style={styles.stepText}>{SCAN_STEPS[stepIndex]}</p>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${((stepIndex + 1) / SCAN_STEPS.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  button: {
    width: "100%",
    padding: "14px",
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
    background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    width: "85%",
    maxWidth: "320px",
    backgroundColor: "#12151c",
    border: "1px solid #232838",
    borderRadius: "16px",
    padding: "28px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
  },
  spinnerRing: {
    width: "90px",
    height: "90px",
    borderRadius: "50%",
    border: "3px solid #1e2330",
    borderTopColor: "#3b82f6",
    borderRightColor: "#06b6d4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "spin 1.4s linear infinite",
  },
  spinnerCore: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "radial-gradient(circle, #3b82f6, transparent 70%)",
  },
  pairLabel: {
    color: "#9aa3b2",
    fontSize: "13px",
    margin: 0,
  },
  stepText: {
    color: "#fff",
    fontSize: "14px",
    textAlign: "center",
    minHeight: "20px",
    margin: 0,
  },
  progressTrack: {
    width: "100%",
    height: "4px",
    backgroundColor: "#1e2330",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    transition: "width 0.3s ease",
  },
};
