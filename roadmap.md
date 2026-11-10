# SARJAVA Gemini upgrade

- [x] Inspect existing analyzer, Judge0 integration, routes, UI, and backend configuration.
- [x] Enable Lovable Cloud through existing project permissions; no application schema changes.
- [x] Fold in the user's step-by-step request: present the secure Gemini key form before implementing, keep current features and design intact, and do not substitute the Edge Functions suggestion for this TanStack project's server-function boundary.
- [ ] The user pasted a credential into chat after the secure form was completed. Do not use or repeat it; advise revoking/rotating it with Google and updating GEMINI_API_KEY through Project Settings → Secrets.
- [x] Latest request confirms Java-only explanations and explicitly asks to connect the Analyze Code action to Gemini; keep the existing Judge0 result first and show separate AI commentary.
- [x] Use this TanStack Start project's supported server-function boundary for the secret-backed Gemini call; do not create a new Supabase Edge Function.
- [x] User confirmed Java-only scope and asked to continue; implement Gemini as optional commentary after real Judge0 analysis, leaving Python/C unchanged.
- [ ] Review the in-progress integration for type/runtime issues, validate its UI flow, then run applicable checks and commit.
- [ ] Receive confirmation that GEMINI_API_KEY is saved through Project Settings → Secrets. Blocker: user secure setup.
- [ ] Implement separate server-side Gemini explanation function, client action, and AI commentary panel.
- [ ] Test validation, safe failures, commentary isolation, desktop/mobile states, and real Judge0/Gemini flows. Gemini verification waits for the key.