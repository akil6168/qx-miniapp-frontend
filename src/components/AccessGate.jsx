import { useEffect, useState } from "react";
import { getInitData, getTelegramUser } from "../telegram";

export default function AccessGate({ children, apiBaseUrl }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    async function checkAccess() {
      const initData = getInitData();
      const user = getTelegramUser();

      if (!initData || !user) {
        setStatus("error");
        return;
      }

      try {
        const res = await fetch(`${apiBaseUrl}/miniapp/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
          setStatus("denied");
          return;
        }

        const data = await res.json();
        setStatus(data.verified ? "approved" : "denied");
      } catch (err) {
        console.error("Verification check failed:", err);
        setStatus("error");
      }
    }

    checkAccess();
  }, [apiBaseUrl]);

  if (status === "checking") {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.text}>Checking access...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div style={styles.center}>
        <h2 style={styles.title}>🔒 Access Restricted</h2>
        <p style={styles.text}>
          This feature is for verified members only. Please verify your
          account in the bot first.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={styles.center}>
        <h2 style={styles.title}>⚠️ Something went wrong</h2>
        <p style={styles.text}>
          Please open this app from inside Telegram.
        </p>
      </div>
    );
  }

  return children;
}

const styles = {
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#0d0f14",
    color: "#ffffff",
    padding: "24px",
    textAlign: "center",
    fontFamily: "system-ui, sans-serif",
  },
  title: {
    fontSize: "20px",
    marginBottom: "8px",
  },
  text: {
    fontSize: "14px",
    color: "#9aa3b2",
    lineHeight: 1.5,
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #2a2f3a",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginBottom: "16px",
  },
};
