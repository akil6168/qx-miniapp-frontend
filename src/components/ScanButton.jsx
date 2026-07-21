export default function ScanButton({ pair, onStart, disabled }) {
  function handleClick() {
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const entryEpoch = nextMinute + 60000;
    const revealEpoch = entryEpoch - 20000;

    onStart({ pair, entryEpoch, revealEpoch });
  }

  return (
    <button onClick={handleClick} disabled={disabled} style={{ ...styles.button, opacity: disabled ? 0.6 : 1 }}>
      {disabled ? "⏳ Signal In Progress" : "🔍 Scan Market"}
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
