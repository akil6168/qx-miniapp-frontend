const REASON_LABELS = {
  TIMEFRAME_MISMATCH: "১ মিনিট ও ৫ মিনিট টাইমফ্রেম ভিন্ন দিক দেখাচ্ছে — মার্কেট এখন অস্থির",
  SIDEWAYS_MARKET: "মার্কেট এখন সাইডওয়ে (দুর্বল ট্রেন্ড) — ট্রেড করার মতো সেটআপ নেই",
  LOW_AGREEMENT: "ইন্ডিকেটরগুলোর মধ্যে যথেষ্ট মিল নেই — নিরাপদ সিগন্যাল নেই",
  NETWORK_ERROR: "সার্ভারে সংযোগ করা যায়নি, আবার চেষ্টা করুন",
};

export default function SignalResult({ result, onClose }) {
  if (!result) return null;

  const isUp = result.direction === "UP⏫";

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        {result.signal ? (
          <>
            <p style={styles.symbol}>{result.symbol}</p>
            <div
              style={{
                ...styles.directionBadge,
                backgroundColor: isUp ? "#16a34a" : "#dc2626",
              }}
            >
              {isUp ? "📈 CALL (UP)" : "📉 PUT (DOWN)"}
            </div>
            <p style={styles.confidence}>কনফিডেন্স: {result.confidencePct}%</p>
            <div style={styles.detailBox}>
              <DetailRow label="RSI" value={result.detail?.rsi} />
              <DetailRow label="ADX (ট্রেন্ড শক্তি)" value={result.detail?.adx} />
              <DetailRow label="প্যাটার্ন" value={result.detail?.pattern} />
              <DetailRow label="১মিন মিল" value={`${result.detail?.m1Agreement}%`} />
              <DetailRow label="৫মিন মিল" value={`${result.detail?.m5Agreement}%`} />
            </div>
            <p style={styles.disclaimer}>
              ⚠️ নিজ দায়িত্বে ট্রেড করুন, লস হলে ওভার-ট্রেড করবেন না
            </p>
          </>
        ) : (
          <>
            <div style={styles.noSignalIcon}>⏸️</div>
            <p style={styles.noSignalTitle}>এখন কোনো সিগন্যাল নেই</p>
            <p style={styles.noSignalReason}>
              {REASON_LABELS[result.reason] || "এই মুহূর্তে নিরাপদ সেটআপ পাওয়া যায়নি"}
            </p>
            <p style={styles.disclaimer}>একটু পর আবার Scan করে দেখুন</p>
          </>
        )}
        <button style={styles.closeButton} onClick={onClose}>
          বন্ধ করুন
        </button>
      </div>
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
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    width: "85%",
    maxWidth: "340px",
    backgroundColor: "#12151c",
    border: "1px solid #232838",
    borderRadius: "16px",
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    fontFamily: "system-ui, sans-serif",
  },
  symbol: { color: "#9aa3b2", fontSize: "13px", margin: 0 },
  directionBadge: {
    padding: "10px 24px",
    borderRadius: "10px",
    color: "#fff",
    fontWeight: "700",
    fontSize: "18px",
  },
  confidence: { color: "#fff", fontSize: "15px", margin: "4px 0" },
  detailBox: { width: "100%", marginTop: "8px" },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    borderBottom: "1px solid #1e2330",
    fontSize: "13px",
  },
  detailLabel: { color: "#9aa3b2" },
  detailValue: { color: "#fff" },
  noSignalIcon: { fontSize: "36px" },
  noSignalTitle: { color: "#fff", fontSize: "16px", fontWeight: "600", margin: 0 },
  noSignalReason: {
    color: "#9aa3b2",
    fontSize: "13px",
    textAlign: "center",
    margin: 0,
  },
  disclaimer: {
    color: "#6b7280",
    fontSize: "11px",
    textAlign: "center",
    marginTop: "8px",
  },
  closeButton: {
    marginTop: "10px",
    width: "100%",
    padding: "12px",
    backgroundColor: "#1e2330",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
  },
};
