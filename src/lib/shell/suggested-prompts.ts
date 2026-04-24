import type { AskCivicaSuggestion } from "@/components/shell/AskCivicaPanel";

export const LANDING_PROMPTS: AskCivicaSuggestion[] = [
  { q: "What is the Civica Index?", label: "What is the Civica Index?" },
  { q: "Which country has the best democratic institutions?", label: "Best democracies" },
  { q: "Compare USA and France", label: "USA vs. France" },
  { q: "Show me the countries that improved most last year", label: "Most-improved" },
];

export const ATLAS_MAP_PROMPTS: AskCivicaSuggestion[] = [
  { q: "Give me a quick tour of the Atlas.", label: "How to use the Atlas" },
  { q: "Which countries are marked as strong democracies?", label: "Strong democracies" },
  { q: "Show me the most unstable regions right now.", label: "Unstable regions" },
];

export const ATLAS_COUNTRY_PROMPTS: AskCivicaSuggestion[] = [
  { q: "Who has the majority and how stable is the coalition?", label: "Majority stability" },
  { q: "What's the most controversial bill in motion right now?", label: "Controversial bill" },
  { q: "How does this chamber compare to the United States House?", label: "Vs. US House" },
  { q: "Walk me through how a bill becomes law here.", label: "How a bill becomes law" },
];

export const COMPARE_PROMPTS: AskCivicaSuggestion[] = [
  { q: "What are the biggest differences in how power flows?", label: "Differences in power" },
  { q: "Compare their electoral systems.", label: "Electoral systems" },
  { q: "Which has the stronger executive?", label: "Stronger executive" },
  { q: "How do their governance scores differ and why?", label: "Score differences" },
];

export const CI_INDEX_PROMPTS: AskCivicaSuggestion[] = [
  { q: "Why do Nordic countries score so high?", label: "Why Nordics score high" },
  { q: "What drives the gap between parliamentary and presidential systems?", label: "Parliamentary vs Presidential" },
  { q: "Explain the Pulse dimension — how does it work?", label: "What is Pulse?" },
  { q: "Which country has improved most in the last year?", label: "Most-improved" },
];

export const WIDGET_PROMPTS: AskCivicaSuggestion[] = [
  { q: "What's the best place to embed one of these widgets?", label: "Where to embed" },
  { q: "What does the Civica Pulse dot show on the widget?", label: "Pulse dot meaning" },
  { q: "Can I change the theme to match my site?", label: "Theme options" },
  { q: "How often do widget scores refresh?", label: "Refresh cadence" },
];
