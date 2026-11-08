import { useAuthStore } from "../stores/auth.js";
export const requireSession = (to) => {
  const authenticated = useAuthStore().isSessionValid();
  if (to.meta.requiresAuth) {
    if (!authenticated) {
      return { name: "authentication" };
    }
  }
  if (to.name === "authentication" && authenticated) {
    return { name: "home" };
  }
};
