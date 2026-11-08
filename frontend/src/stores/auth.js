import { ref, onScopeDispose } from "vue";
import { defineStore } from "pinia";
import { isValidSession, createSessionManager } from "../session.mjs";
import { backendUrl, requestJson } from "../request.mjs";
const STORAGE_KEY = "scoreboard-session";
export const useAuthStore = defineStore("auth", () => {
  const token = ref("");
  const expires = ref(0);
  let expiryTimer;
  let expiryGeneration = 0;
  function publish(session) {
    clearTimeout(expiryTimer);
    const generation = ++expiryGeneration;
    token.value = session.token; expires.value = session.expires;
    if (session.token) scheduleExpiry(generation);
  }
  function scheduleExpiry(generation) {
    expiryTimer = setTimeout(() => {
      if (generation !== expiryGeneration) return;
      if (isSessionValid()) scheduleExpiry(generation);
    }, Math.min(Math.max(0, expires.value - Date.now()), 2147483647));
  }
  const manager = createSessionManager({
    read: () => sessionStorage.getItem(STORAGE_KEY),
    write: value => sessionStorage.setItem(STORAGE_KEY, value),
    remove: () => sessionStorage.removeItem(STORAGE_KEY),
    publish,
    fetchLogin: (username, password) => requestJson(`${backendUrl(import.meta.env.VITE_BASE_URL, import.meta.env.DEV)}/api/auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  });
  manager.restore();
  function isSessionValid() {
    const valid = isValidSession({ token: token.value, expires: expires.value });
    if (!valid && (token.value || expires.value)) manager.logout();
    return valid;
  }
  const recheck = () => { if (document.visibilityState === "visible") isSessionValid(); };
  document.addEventListener("visibilitychange", recheck);
  onScopeDispose(() => {
    expiryGeneration++;
    clearTimeout(expiryTimer);
    document.removeEventListener("visibilitychange", recheck);
  });
  return { isSessionValid, token, expires, login: manager.login, logout: manager.logout };
});
