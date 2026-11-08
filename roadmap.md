# SARJAVA Gemini upgrade

- [x] Inspect existing analyzer, Judge0 integration, routes, UI, and backend configuration.
- [x] Enable Lovable Cloud through existing project permissions; no application schema changes.
- [x] Fold in the user's step-by-step request: present the secure Gemini key form before implementing, keep current features and design intact, and do not substitute the Edge Functions suggestion for this TanStack project's server-function boundary.
- [ ] The user pasted a credential into chat after the secure form was completed. Do not use or repeat it; advise revoking/rotating it with Google and updating GEMINI_API_KEY through Project Settings → Secrets.
- [ ] Receive confirmation that GEMINI_API_KEY is saved through Project Settings → Secrets. Blocker: user secure setup.
- [ ] Implement separate server-side Gemini explanation function, client action, and AI commentary panel.
- [ ] Test validation, safe failures, commentary isolation, desktop/mobile states, and real Judge0/Gemini flows. Gemini verification waits for the key.