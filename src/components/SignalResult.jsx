import { useEffect, useRef, useState } from "react";
import { getInitData } from "../telegram";

const SCAN_MESSAGES = [
  "🧠 Initializing Deep Market Analysis...",
  "📡 Fetching Live Price Feed...",
  "📊 Analyzing Price Action...",
  "📈 Checking Trend Direction & Momentum...",
  "🔍 Evaluating Momentum Indicators (RSI)...",
  "📉 Measuring Trend Strength (ADX)...",
  "🌊 Scanning Volatility Patterns...",
  "🕯️ Detecting Candlestick Patterns...",
  "📐 Analyzing Bollinger Band Position...",
  "🌀 Reviewing MACD Histogram...",
  "🎯 Cross-Verifying 1M & 5M Timeframes...",
  "🧮 Aggregating Indicator Consensus...",
  "⚖️ Calculating Probability Score...",
  "🔒 Validating Signal Confidence...",
  "✅ Finalizing Analysis Result...",
];

const SAMPLE_INTERVAL_MS = 15000;
const SCAN_MESSAGE_ROTATE_MS = 1800;
const NO_SETUP_HIDE_MS = 8000;
const TRADE_DONE_HIDE_MS = 2000;

function fmtBDTime(epochMs) {
  const d = new Date(epochMs + 6 * 60 * 60 * 1000);
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

async function fetchSample(apiBaseUrl, pair) {
  try {
    const initData = getInitData();
    const res = await fetch(`${apiBaseUrl}/miniapp/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, symbol: pair }),
    });
    return await res.json();
  } catch (err) {
    console.error("Sample fetch failed:", err);
    return { signal: false, reason: "NETWORK_ERROR" };
  }
}

function finalizeSamples(samples) {
  const signalSamples = samples.filter((s) => s.signal);
  if (signalSamples.length === 0) {
    return samples[samples.length - 1] || { signal: false, reason: "LOW_AGREEMENT" };
  }
  const upVotes = signalSamples.filter((s) => s.direction === "UP⏫");
  const downVotes = signalSamples.filter((s) => s.direction === "DOWN⏬");
  const majority = upVotes.length >= downVotes.length ? upVotes : downVotes;
  const avgConfidence = Math.round(majority.reduce((sum, s) => sum + s.confidencePct, 0) / majority.length);
  const latestMatching = [...majority].reverse()[0];
  return {
    signal: true,
    direction: majority === upVotes ? "UP⏫" : "DOWN⏬",
    confidencePct: avgConfidence,
    symbol: latestMatching.symbol,
    detail: latestMatching.detail,
  };
}

export default function SignalResult({ apiBaseUrl, pair, entryEpoch, revealEpoch, onDone }) {
  const [now, setNow] = useState(Date.now());
  const [finalResult, setFinalResult] = useState(null);
  const [scanMsgIndex, setScanMsgIndex] = useState(0);

  const samplesRef = useRef([]);
  const pollTimerRef = useRef(null);
  const finalizedRef = useRef(false);
  const hideTimerStartedRef = useRef(false);
  const closeEpoch = entryEpoch + 60000;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // মেসেজ একবার শেষ পর্যন্ত এগোবে, তারপর শেষ মেসেজেই থেমে থাকবে — লুপ করবে না
  useEffect(() => {
    const t = setInterval(() => {
      setScanMsgIndex((i) => Math.min(i + 1, SCAN_MESSAGES.length - 1));
    }, SCAN_MESSAGE_ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function pollLoop() {
      if (cancelled || Date.now() >= revealEpoch) return;
      const sample = await fetchSample(apiBaseUrl, pair);
      if (cancelled) return;
      samplesRef.current.push(sample);
      pollTimerRef.current = setTimeout(pollLoop, SAMPLE_INTERVAL_MS);
    }
    pollLoop();
    return () => {
      cancelled = true;
      clearTimeout(pollTimerRef.current);
    };
  }, [apiBaseUrl, pair, revealEpoch]);

  useEffect(() => {
    if (finalizedRef.current || now < revealEpoch) return;
    finalizedRef.current = true;
    clearTimeout(pollTimerRef.current);
    (async () => {
      const lastSample = await fetchSample(apiBaseUrl, pair);
      samplesRef.current.push(lastSample);
      setFinalResult(finalizeSamples(samplesRef.current));
    })();
  }, [now, revealEpoch, apiBaseUrl, pair]);

  useEffect(() => {
    if (hideTimerStartedRef.current) return;

    if (finalResult?.signal && now >= closeEpoch) {
      hideTimerStartedRef.current = true;
      const t = setTimeout(() => onDone(), TRADE_DONE_HIDE_MS);
      return () => clearTimeout(t);
    }

    if (finalResult && !finalResult.signal) {
      hideTimerStartedRef.current = true;
      const t = setTimeout(() => onDone(), NO_SETUP_HIDE_MS);
      return () => clearTimeout(t);
    }
  }, [finalResult, now, closeEpoch, onDone]);

  let phase;
  if (now < revealEpoch) phase = "scanning";
  else if (!finalResult) phase = "finalizing";
  else if (!finalResult.signal) phase = "no-setup";
  else if (now < entryEpoch) phase = "entry-pending";
  else if (now < closeEpoch) phase = "active";
  else phase = "done";

  const secondsUntilReveal = Math.max(0, Math.ceil((revealEpoch - now) / 1000));
  const secondsUntilEntry = Math.max(0, Math.ceil((entryEpoch - now) / 1000));
  const secondsUntilClose = Math.max(0, Math.ceil((closeEpoch - now) / 1000));

  return (
    <div style={styles.card}>
      <div style={styles.glowBar} />

      <div style={styles.headerRow}>
        <span style={styles.symbol}>{pair}</span>
        {finalResult?.signal && (
          <span style={{ ...styles.directionTag, background: finalResult.direction === "UP⏫" ? "linear-gradient(135deg,#16a34a,#22c55e)" : "linear-gradient(135deg,#dc2626,#ef4444)" }}>
            {finalResult.direction === "UP⏫" ? "📈 CALL" : "📉 PUT"}
          </span>
        )}
      </div>

      {(phase === "scanning" || phase === "finalizing") && (
        <>
          <div style={styles.scannerRing}>
            <div style={styles.scannerCore} />
          </div>
          <p style={styles.scanText}>{phase === "finalizing" ? "🧩 Finalizing Signal..." : SCAN_MESSAGES[scanMsgIndex]}</p>
          <div style={styles.timeGrid}>
            <TimeBox label="ENTRY TIME" value={fmtBDTime(entryEpoch)} />
            <TimeBox label="CLOSE TIME" value={fmtBDTime(closeEpoch)} />
          </div>
          {phase === "scanning" && (
            <div style={styles.countdownRow}>
              <span style={styles.countdownLabel}>SIGNAL REVEALS IN</span>
              <span style={styles.countdownValue}>{secondsUntilReveal}s</span>
            </div>
          )}
        </>
      )}

      {phase === "no-setup" && (
        <>
          <div style={styles.noSetupIcon}>📉</div>
          <p style={styles.noSetupTitle}>Market Conditions Not Favorable</p>
          <p style={styles.noSetupReason}>
            No high-probability setup found right now. Try scanning again shortly.
          </p>
        </>
      )}

      {phase !== "scanning" && phase !== "finalizing" && phase !== "no-setup" && finalResult?.signal && (
        <>
          <p style={styles.confidence}>Confidence: {finalResult.confidencePct}%</p>

          <div style={styles.statusBadge}>
            {phase === "entry-pending" && `⏳ Entry starts in ${secondsUntilEntry}s`}
            {phase === "active" && `🟢 Trade Now — ${secondsUntilClose}s remaining`}
            {phase === "done" && `✅ Trade Complete`}
          </div>

          <div style={styles.timeGrid}>
            <TimeBox label="ENTRY TIME" value={fmtBDTime(entryEpoch)} />
            <TimeBox label="CLOSE TIME" value={fmtBDTime(closeEpoch)} />
          </div>

          {phase !== "done" && (
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: phase === "entry-pending" ? `${100 - (secondsUntilEntry / 20) * 100}%` : `${100 - (secondsUntilClose / 60) * 100}%`,
                  background: phase === "active" ? "linear-gradient(90deg,#dc2626,#f97316)" : "linear-gradient(90deg,#3b82f6,#06b6d4)",
                }}
              />
            </div>
          )}

          <div style={styles.mtgNote}>⚠️ 1 STEP MTG — If this trade loses, re-enter the same direction on the next candle</div>

          <div style={styles.detailBox}>
            <DetailRow label="RSI" value={finalResult.detail?.rsi} />
            <DetailRow label="ADX (Trend Strength)" value={finalResult.detail?.adx} />
            <DetailRow label="Pattern" value={finalResult.detail?.pattern} />
            <DetailRow label="1M Agreement" value={`${finalResult.detail?.m1Agreement}%`} />
            <DetailRow label="5M Agreement" value={`${finalResult.detail?.m5Agreement}%`} />
          </div>
          <p style={styles.disclaimer}>⚠️ Trade at your own risk. Do not over-trade after a loss.</p>
        </>
      )}
    </div>
  );
}

function TimeBox({ label, value }) {
  return (
    <div style={styles.timeBox}>
      <span style={styles.timeLabel}>{label}</span>
      <span style={styles.timeValue}>{value}</span>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (value === undefined || value === null) return null;
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

const styles = {
  card: {
    width: "100%",
    boxSizing: "border-box",
    maxWidth: "100%",
    overflow: "hidden",
    position: "relative",
    background: "linear-gradient(180deg,#151922,#0f1218)",
    border: "1px solid #262c3a",
    borderRadius: "18px",
    padding: "20px 16px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    fontFamily: "system-ui, sans-serif",
    marginTop: "14px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  },
  glowBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "3px",
    background: "linear-gradient(90deg,#3b82f6,#06b6d4,#3b82f6)",
    backgroundSize: "200% 100%",
    animation: "signalGlow 2.5s linear infinite",
  },
  headerRow: { width: "100%", boxSizing: "border-box", display: "flex", justifyContent: "space-between", alignItems: "center" },
  symbol: { color: "#9aa3b2", fontSize: "13px" },
  directionTag: { color: "#fff", fontSize: "12px", fontWeight: "700", padding: "5px 12px", borderRadius: "7px" },
  scannerRing: {
    width: "64px", height: "64px", borderRadius: "50%",
    border: "3px solid #1e2330",
    borderTopColor: "#3b82f6",
    borderRightColor: "#06b6d4",
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "signalSpin 1.1s linear infinite",
  },
  scannerCore: {
    width: "26px", height: "26px", borderRadius: "50%",
    background: "radial-gradient(circle,#3b82f6,transparent 70%)",
  },
  scanText: {
    color: "#dbeafe", fontSize: "13px", fontWeight: "600", textAlign: "center",
    margin: 0, minHeight: "18px", maxWidth: "100%", wordBreak: "break-word",
  },
  noSetupIcon: { fontSize: "30px" },
  noSetupTitle: { color: "#fff", fontSize: "15px", fontWeight: "700", margin: 0, textAlign: "center" },
  noSetupReason: {
    color: "#9aa3b2", fontSize: "12.5px", textAlign: "center", margin: 0,
    maxWidth: "100%", wordBreak: "break-word", lineHeight: 1.5,
  },
  statusBadge: {
    color: "#fff", fontSize: "13px", fontWeight: "600",
    backgroundColor: "#1e2330", padding: "6px 14px", borderRadius: "8px",
    maxWidth: "100%", boxSizing: "border-box", textAlign: "center", wordBreak: "break-word",
  },
  timeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "100%", boxSizing: "border-box" },
  timeBox: { backgroundColor: "#1a1e28", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: 0 },
  timeLabel: { color: "#6b7280", fontSize: "10px", letterSpacing: "0.5px" },
  timeValue: { color: "#fff", fontSize: "18px", fontWeight: "700" },
  countdownRow: { display: "flex", justifyContent: "space-between", width: "100%", fontSize: "13px", boxSizing: "border-box" },
  countdownLabel: { color: "#6b7280" },
  countdownValue: { color: "#fff", fontWeight: "700" },
  confidence: { color: "#fff", fontSize: "15px", margin: 0 },
  mtgNote: {
    width: "100%", boxSizing: "border-box", color: "#fbbf24", fontSize: "12px", fontWeight: "600",
    backgroundColor: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
    borderRadius: "8px", padding: "8px 10px", textAlign: "center", wordBreak: "break-word",
  },
  detailBox: { width: "100%", boxSizing: "border-box", marginTop: "4px" },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2330", fontSize: "13px" },
  detailLabel: { color: "#9aa3b2" },
  detailValue: { color: "#fff" },
  disclaimer: { color: "#6b7280", fontSize: "11px", textAlign: "center", marginTop: "4px", maxWidth: "100%", wordBreak: "break-word" },
  progressTrack: { width: "100%", boxSizing: "border-box", height: "5px", backgroundColor: "#1e2330", borderRadius: "3px", overflow: "hidden" },
  progressFill: { height: "100%", transition: "width 1s linear" },
};
