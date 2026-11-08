import { defineStore } from "pinia";
import { useAuthStore } from "./auth.js";
import { apiGet } from "@/api.js";
import { questionTotal, teamTotal, rankTeams } from "../scoring.mjs";

const text = value => typeof value === "string" || typeof value === "number" ? String(value) : "";
const key = competition => text(competition.variables?.panel).trim() || text(competition.title);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const useCompetitionStore = defineStore("competition", {
  state: () => ({
    competitions: [],
    competition: null,
  }),
  getters: {
    teams: (state) => state.competition.teams,
    teamById: (state) => (id) =>
      state.competition.teams.find((team) => team.id === id),
    ratingQuestionsIds: (state) =>
      state.competition.ratingQuestions.map((q) => q.id),
    ratingQuestionById: (state) => (id) =>
      state.competition.ratingQuestions.find((q) => q.id === id),
    overallQuestionsRating: (state) =>
      state.competition.ratingQuestions.reduce((acc, q) => acc + q.max, 0),
    competitionDetails: (state) => (id) =>
      state.competitions.find((c) => c.id === id),
  },
  actions: {
    async fetchCompetitions(isCurrent = () => true) {
      const auth = useAuthStore();
      const session = auth.token;
      // Refresh on every entry/retry; never retain a list across sessions.
      const result = (await apiGet("")).sort((a, b) =>
        compare(key(a), key(b)) || compare(text(a.title), text(b.title)) || compare(text(a.id), text(b.id)));
      if (isCurrent() && auth.token === session && auth.isSessionValid()) this.competitions = result;
    },
    async fetchCompetition(id, isCurrent = () => true) {
      const auth = useAuthStore();
      const session = auth.token;
      this.competition = null;

      const result = await apiGet(encodeURIComponent(id));
      if (isCurrent() && auth.token === session && auth.isSessionValid()) this.competition = result;
    },
    getOverallQuestionRating(teamId, questionId) {
      return questionTotal(this.teamById(teamId), questionId);
    },
    getTeamOverallRating(teamId) {
      return teamTotal(this.teamById(teamId), this.ratingQuestionsIds);
    },
    orderedTeams(teams) {
      return rankTeams(teams, this.ratingQuestionsIds);
    },
  },
});
