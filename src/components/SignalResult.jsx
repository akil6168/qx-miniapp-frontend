import { useEffect, useRef, useState } from "react";
import { getInitData } from "../telegram";

const REASON_LABELS = {
  TIMEFRAME_MISMATCH: "১ মিনিট ও ৫ মিনিট টাইমফ্রেম ভিন্ন দিক দেখাচ্ছে — মার্কেট এখন অস্থির",
  SIDEWAYS_MARKET: "মার্কেট এখন সাইডওয়ে (দুর্বল ট্রেন্ড) — ট্রেড করার মতো সেটআপ নেই",
  LOW_AGREEMENT: "ইন্ডিকেটরগুলোর মধ্যে যথেষ্ট মিল নেই — নিরাপদ সিগন্যাল নেই",
  NETWORK_ERROR: "সার্ভারে সংযোগ করা যায়নি, আবার চেষ্টা করুন",
};

const SAMPLE_INTERVAL_MS = 15000;
const RESULT_POLL_MS = 4000;
const AUTO_HIDE_MS = 10000;

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

async function fetchResult(apiBaseUrl, symbol, direction, entryEpochMs) {
  try {
    const initData = getInitData();
    const res = await fetch(`${apiBaseUrl}/miniapp/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, symbol, direction, entryEpochMs }),
    });
    return await res.json();
  } catch (err) {
    console.error("Result fetch failed:", err);
    return { status: "pending" };
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
    sampleCount: samples.length,
    agreeCount: majority.length,
  };
}

export default function SignalResult({ apiBaseUrl, pair, entryEpoch, revealEpoch, onDone }) {
  const [now, setNow] = useState(Date.now());
  const [finalResult, setFinalResult] = useState(null);
  const [sampleCount, setSampleCount] = useState(0);
  const [round1Result, setRound1Result] = useState(null); // null | WIN | LOSS
  const [round2Result, setRound2Result] = useState(null);
  const [activeRound, setActiveRound] = useState(1);

  const samplesRef = useRef([]);
  const pollTimerRef = useRef(null);
  const finalizedRef = useRef(false);
  const round1CheckStartedRef = useRef(false);
  const round2CheckStartedRef = useRef(false);
  const hideTimerStartedRef = useRef(false);

  const closeEpoch = entryEpoch + 60000;
  const round2Entry = closeEpoch;
  const round2Close = closeEpoch + 60000;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // প্রাথমিক বিশ্লেষণ — reveal পর্যন্ত বারবার sample নেওয়া
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

  // রাউন্ড ১ ফলাফল চেক (ক্লোজ টাইম পার হওয়ার পর)
  useEffect(() => {
    if (!finalResult?.signal) return;
    if (now < closeEpoch) return;
    if (round1CheckStartedRef.current) return;
    round1CheckStartedRef.current = true;

    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      const res = await fetchResult(apiBaseUrl, pair, finalResult.direction, entryEpoch);
      if (cancelled) return;
      if (res.status === "done") {
        setRound1Result(res.result);
        if (res.result === "LOSS") setActiveRound(2);
      } else {
        setTimeout(poll, RESULT_POLL_MS);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [finalResult, now, closeEpoch, apiBaseUrl, pair, entryEpoch]);

  // রাউন্ড ২ (MTG) ফলাফল চেক
  useEffect(() => {
    if (round1Result !== "LOSS") return;
    if (now < round2Close) return;
    if (round2CheckStartedRef.current) return;
    round2CheckStartedRef.current = true;

    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      const res = await fetchResult(apiBaseUrl, pair, finalResult.direction, round2Entry);
      if (cancelled) return;
      if (res.status === "done") {
        setRound2Result(res.result);
      } else {
        setTimeout(poll, RESULT_POLL_MS);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [round1Result, now, round2Close, apiBaseUrl, pair, finalResult, round2Entry]);

  // চূড়ান্ত ফলাফল পাওয়ার ১০ সেকেন্ড পর কার্ড বন্ধ
  const isGameOver = round1Result === "WIN" || round2Result === "WIN" || round2Result === "LOSS";
  useEffect(() => {
    if (!isGameOver || hideTimerStartedRef.current) return;
    hideTimerStartedRef.current = true;
    const t = setTimeout(onDone, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [isGameOver, onDone]);

  // no-signal কেস — আগের মতোই কিছুক্ষণ পর বন্ধ
  useEffect(() => {
    if (finalResult && !finalResult.signal && !hideTimerStartedRef.current) {
      hideTimerStartedRef.current = true;
      const t = setTimeout(onDone, AUTO_HIDE_MS);
      return () => clearTimeout(t);
    }
  }, [finalResult, onDone]);

  let phase;
  if (now < revealEpoch) phase = "waiting";
  else if (!finalResult) phase = "revealing";
  else if (now < entryEpoch) phase = "entry-pending";
  else if (round1Result === null) phase = "round1-active-or-checking";
  else if (round1Result === "WIN") phase = "final-win";
  else if (round2Result === null) phase = "round2-active-or-checking";
  else phase = "final";

  const secondsUntilReveal = Math.max(0, Math.ceil((revealEpoch - now) / 1000));
  const secondsUntilEntry = Math.max(0, Math.ceil((entryEpoch - now) / 1000));
  const secondsUntilR1Close = Math.max(0, Math.ceil((closeEpoch - now) / 1000));
  const secondsUntilR2Close = Math.max(0, Math.ceil((round2Close - now) / 1000));

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <span style={styles.symbol}>{pair}</span>
        {finalResult?.signal && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ ...styles.directionTag, backgroundColor: finalResult.direction === "UP⏫" ? "#16a34a" : "#dc2626" }}>
              {finalResult.direction === "UP⏫" ? "📈 CALL" : "📉 PUT"}
            </span>
            {activeRound === 2 && <span style={styles.mtgTag}>MTG</span>}
          </div>
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

      {finalResult?.signal && phase !== "waiting" && phase !== "revealing" && (
        <>
          <p style={styles.confidence}>কনফিডেন্স: {finalResult.confidencePct}%</p>
          <p style={styles.sampleNote}>{finalResult.agreeCount}/{finalResult.sampleCount} বার বিশ্লেষণে একই দিক পাওয়া গেছে</p>

          {phase === "entry-pending" && (
            <div style={styles.statusBadge}>⏳ এন্ট্রি শুরু হবে {secondsUntilEntry}s পরে</div>
          )}

          {phase === "round1-active-or-checking" && now < closeEpoch && (
            <div style={styles.statusBadge}>🟢 এখনই ট্রেড করুন — {secondsUntilR1Close}s বাকি</div>
          )}
          {phase === "round1-active-or-checking" && now >= closeEpoch && (
            <div style={styles.statusBadge}>⏱️ ফলাফল যাচাই হচ্ছে...</div>
          )}

          {phase === "final-win" && <ResultBadge result="WIN" label="✅ WIN" />}

          {phase === "round2-active-or-checking" && now < round2Close && (
            <div style={styles.statusBadge}>🟡 MTG চলছে — {secondsUntilR2Close}s বাকি</div>
          )}
          {phase === "round2-active-or-checking" && now >= round2Close && (
            <div style={styles.statusBadge}>⏱️ MTG ফলাফল যাচাই হচ্ছে...</div>
          )}

          {phase === "final" && round2Result === "WIN" && <ResultBadge result="WIN" label="✅ MTG WIN" />}
          {phase === "final" && round2Result === "LOSS" && <ResultBadge result="LOSS" label="❌ LOSS" />}

          <div style={styles.timeGrid}>
            <TimeBox
              label="ENTRY TIME"
              value={fmtBDTime(activeRound === 2 ? round2Entry : entryEpoch)}
            />
            <TimeBox
              label="CLOSE TIME"
              value={fmtBDTime(activeRound === 2 ? round2Close : closeEpoch)}
            />
          </div>

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

function ResultBadge({ result, label }) {
  return (
    <div style={{ ...styles.resultBadge, backgroundColor: result === "WIN" ? "#16a34a" : "#dc2626" }}>
      {label}
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
  headerRow: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  symbol: { color: "#9aa3b2", fontSize: "13px" },
  directionTag: { color: "#fff", fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px" },
  mtgTag: { color: "#0d0f14", fontSize: "10px", fontWeight: "800", backgroundColor: "#f59e0b", padding: "2px 8px", borderRadius: "5px" },
  statusBadge: { color: "#fff", fontSize: "13px", fontWeight: "600", backgroundColor: "#1e2330", padding: "6px 14px", borderRadius: "8px" },
  resultBadge: { color: "#fff", fontSize: "16px", fontWeight: "800", padding: "8px 20px", borderRadius: "10px" },
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
};
