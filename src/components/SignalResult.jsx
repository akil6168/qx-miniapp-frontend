import { useEffect, useRef, useState } from "react";
import { getInitData } from "../telegram";

const REASON_LABELS = {
  TIMEFRAME_MISMATCH: "১ মিনিট ও ৫ মিনিট টাইমফ্রেম ভিন্ন দিক দেখাচ্ছে — মার্কেট এখন অস্থির",
  SIDEWAYS_MARKET: "মার্কেট এখন সাইডওয়ে (দুর্বল ট্রেন্ড) — ট্রেড করার মতো সেটআপ নেই",
  LOW_AGREEMENT: "ইন্ডিকেটরগুলোর মধ্যে যথেষ্ট মিল নেই — নিরাপদ সিগন্যাল নেই",
  NETWORK_ERROR: "সার্ভারে সংযোগ করা যায়নি, আবার চেষ্টা করুন",
};

const SAMPLE_INTERVAL_MS = 15000;

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

  const avgConfidence = Math.round(
    majority.reduce((sum, s) => sum + s.confidencePct, 0) / majority.length
  );

  const latestMatching = [...majority].reverse()[0];

  return {
    signal: true,
    direction: majority === upVotes ? "UP⏫" : "DOWN⏬",
    confidencePct: avgConfidence,
    symbol: latestMatching.symbol,
    detail: latestMatching.detail,
    sampleCount: samples.length,
    agreeCount: majority.length,
  };
}

export default function SignalResult({ apiBaseUrl, pair, entryEpoch, revealEpoch, onDone }) {
  const [now, setNow] = useState(Date.now());
  const [finalResult, setFinalResult] = useState(null);
  const [sampleCount, setSampleCount] = useState(0);
  const samplesRef = useRef([]);
  const pollTimerRef = useRef(null);
  const finalizedRef = useRef(false);
  const closeEpoch = entryEpoch + 60000;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function pollLoop() {
      if (cancelled || Date.now() >= revealEpoch) return;
      const sample = await fetchSample(apiBaseUrl, pair);
      if (cancelled) return;
      samplesRef.current.push(sample);
      setSampleCount(samplesRef.current.length);
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
    if (now > closeEpoch + 3000) onDone();
  }, [now, closeEpoch, onDone]);

  let phase;
  if (now < revealEpoch) phase = "waiting";
  else if (!finalResult) phase = "revealing";
  else if (now < entryEpoch) phase = "entry-pending";
  else if (now < closeEpoch) phase = "active";
  else phase = "done";

  const secondsUntilReveal = Math.max(0, Math.ceil((revealEpoch - now) / 1000));
  const secondsUntilEntry = Math.max(0, Math.ceil((entryEpoch - now) / 1000));
  const secondsUntilClose = Math.max(0, Math.ceil((closeEpoch - now) / 1000));

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <span style={styles.symbol}>{pair}</span>
        {finalResult?.signal && (
          <span style={{ ...styles.directionTag, backgroundColor: finalResult.direction === "UP⏫" ? "#16a34a" : "#dc2626" }}>
            {finalResult.direction === "UP⏫" ? "📈 CALL" : "📉 PUT"}
          </span>
        )}
      </div>

      {phase === "waiting" && (
        <>
          <div style={styles.statusBadge}>🔍 বিশ্লেষণ চলছে... ({sampleCount} বার চেক করা হয়েছে)</div>
          <div style={styles.timeGrid}>
            <TimeBox label="ENTRY TIME" value={fmtBDTime(entryEpoch)} />
            <TimeBox label="CLOSE TIME" value={fmtBDTime(closeEpoch)} />
          </div>
          <div style={styles.countdownRow}>
            <span style={styles.countdownLabel}>SIGNAL REVEALS IN</span>
            <span style={styles.countdownValue}>{secondsUntilReveal}s</span>
          </div>
        </>
      )}

      {phase === "revealing" && <div style={styles.statusBadge}>🧠 চূড়ান্ত সিদ্ধান্ত নেওয়া হচ্ছে...</div>}

      {phase !== "waiting" && phase !== "revealing" && finalResult && !finalResult.signal && (
        <>
          <div style={styles.noSignalIcon}>⏸️</div>
          <p style={styles.noSignalTitle}>এখন কোনো সিগন্যাল নেই</p>
          <p style={styles.noSignalReason}>{REASON_LABELS[finalResult.reason] || "এই মুহূর্তে নিরাপদ সেটআপ পাওয়া যায়নি"}</p>
        </>
      )}

      {phase !== "waiting" && phase !== "revealing" && finalResult?.signal && (
        <>
          <p style={styles.confidence}>কনফিডেন্স: {finalResult.confidencePct}%</p>
          <p style={styles.sampleNote}>
            {finalResult.agreeCount}/{finalResult.sampleCount} বার বিশ্লেষণে একই দিক পাওয়া গেছে
          </p>
          <div style={styles.statusBadge}>
            {phase === "entry-pending" && `⏳ এন্ট্রি শুরু হবে ${secondsUntilEntry}s পরে`}
            {phase === "active" && `🟢 এখনই ট্রেড করুন — ${secondsUntilClose}s বাকি`}
            {phase === "done" && `✅ ট্রেড সম্পন্ন`}
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
                  backgroundColor: phase === "active" ? "#dc2626" : "#3b82f6",
                }}
              />
            </div>
          )}
          <div style={styles.detailBox}>
            <DetailRow label="RSI" value={finalResult.detail?.rsi} />
            <DetailRow label="ADX (ট্রেন্ড শক্তি)" value={finalResult.detail?.adx} />
            <DetailRow label="প্যাটার্ন" value={finalResult.detail?.pattern} />
            <DetailRow label="১মিন মিল" value={`${finalResult.detail?.m1Agreement}%`} />
            <DetailRow label="৫মিন মিল" value={`${finalResult.detail?.m5Agreement}%`} />
          </div>
          <p style={styles.disclaimer}>⚠️ নিজ দায়িত্বে ট্রেড করুন, লস হলে ওভার-ট্রেড করবেন না</p>
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
  card: { width: "100%", backgroundColor: "#12151c", border: "1px solid #232838", borderRadius: "16px", padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", fontFamily: "system-ui, sans-serif", marginTop: "14px" },
  headerRow: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" },
  symbol: { color: "#9aa3b2", fontSize: "13px" },
  directionTag: { color: "#fff", fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px" },
  statusBadge: { color: "#fff", fontSize: "13px", fontWeight: "600", backgroundColor: "#1e2330", padding: "6px 14px", borderRadius: "8px" },
  timeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "100%" },
  timeBox: { backgroundColor: "#1a1e28", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" },
  timeLabel: { color: "#6b7280", fontSize: "10px", letterSpacing: "0.5px" },
  timeValue: { color: "#fff", fontSize: "18px", fontWeight: "700" },
  countdownRow: { display: "flex", justifyContent: "space-between", width: "100%", fontSize: "13px" },
  countdownLabel: { color: "#6b7280" },
  countdownValue: { color: "#fff", fontWeight: "700" },
  confidence: { color: "#fff", fontSize: "15px", margin: 0 },
  sampleNote: { color: "#6b7280", fontSize: "11px", margin: 0 },
  detailBox: { width: "100%", marginTop: "4px" },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e2330", fontSize: "13px" },
  detailLabel: { color: "#9aa3b2" },
  detailValue: { color: "#fff" },
  noSignalIcon: { fontSize: "30px" },
  noSignalTitle: { color: "#fff", fontSize: "15px", fontWeight: "600", margin: 0 },
  noSignalReason: { color: "#9aa3b2", fontSize: "13px", textAlign: "center", margin: 0 },
  disclaimer: { color: "#6b7280", fontSize: "11px", textAlign: "center", marginTop: "4px" },
  progressTrack: { width: "100%", height: "5px", backgroundColor: "#1e2330", borderRadius: "3px", overflow: "hidden" },
  progressFill: { height: "100%", transition: "width 1s linear" },
};
