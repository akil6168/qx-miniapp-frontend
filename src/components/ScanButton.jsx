export default function ScanButton({ pair, onStart, disabled }) {
  function handleClick() {
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const entryEpoch = nextMinute + 60000; // এক ক্যান্ডেল স্কিপ করে পরের ক্যান্ডেলকে টার্গেট করা হয়
    const revealEpoch = entryEpoch - 20000; // এন্ট্রির ২০ সেকেন্ড আগে সিগন্যাল প্রকাশ

    onStart({ pair, entryEpoch, revealEpoch });
  }

  return (
    <button onClick={handleClick} disabled={disabled} style={{ ...styles.button, opacity: disabled ? 0.6 : 1 }}>
      {disabled ? "সিগন্যাল চলমান..." : "🔍 Scan Market"}
    </button>
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
};
