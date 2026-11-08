<script setup>
import { RouterView, useRouter, useRoute } from "vue-router";
import { watch } from "vue";
import { useAuthStore } from "./stores/auth.js";
import { useCompetitionStore } from "./stores/competition.js";
const auth = useAuthStore();
const competitions = useCompetitionStore();
const router = useRouter();
const route = useRoute();
watch(() => auth.token, () => {
  competitions.$reset();
  if (!auth.token && route.meta.requiresAuth) router.replace({ name: "authentication" });
}, { flush: "sync" });
import TheHeader from "@/components/TheHeader.vue";
import TheFooter from "@/components/TheFooter.vue";
</script>

<template>
  <TheHeader />

  <RouterView />

  <TheFooter />
</template>
