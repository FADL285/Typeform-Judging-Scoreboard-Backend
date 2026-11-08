export { createPinia, setActivePinia } from 'pinia';
export { createRouter, createMemoryHistory } from 'vue-router';
export { useAuthStore } from '../src/stores/auth.js';
export { useCompetitionStore } from '../src/stores/competition.js';
export { requireSession } from '../src/router/guard.js';
