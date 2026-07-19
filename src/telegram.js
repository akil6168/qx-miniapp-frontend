export function getTelegramWebApp() {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (!tg) {
    console.warn("Telegram WebApp SDK not found — are you testing outside Telegram?");
    return null;
  }

  tg.ready();
  tg.expand();
  tg.setHeaderColor("#0d0f14");

  return tg;
}

export function getInitData() {
  const tg = getTelegramWebApp();
  return tg ? tg.initData : null;
}

export function getTelegramUser() {
  const tg = getTelegramWebApp();
  if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) return null;
  return tg.initDataUnsafe.user;
}
