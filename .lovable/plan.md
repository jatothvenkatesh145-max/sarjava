# Secure Gemini commentary for SARJAVA

## Inspection findings
- SARJAVA already runs Java, Python, and C through Judge0 CE and offers a separately labeled simulated mode.
- Existing compiler/runtime diagnostics, explanations, corrections, output, routes, and local history remain unchanged.
- Lovable Cloud has now been enabled using the project's current permissions. No application tables or new login flow are needed.
- GEMINI_API_KEY is not configured. No Gemini request has been made and no AI implementation has been added yet.

## Secure step — waiting on you
Add your Gemini key in **Project Settings → Secrets**, named exactly **GEMINI_API_KEY**, and confirm it is saved. Never paste the key in chat. Approval of this plan alone does not establish that the key exists; implementation can prepare an unavailable state, but live Gemini testing waits for the saved secret.

## Requested experience
- Add a separate **AI commentary · Gemini** panel below Error Analysis, preserving the current visual style and mobile tabs.
- Provide an explicit **Explain with Gemini** action that sends the analyzed Java source and diagnostics to Google only on request.
- Show a plain-English summary, diagnostic explanations with referenced line numbers, suggested fixes, and code improvement suggestions. Mark these as AI advice, not compiler-confirmed results.
- Include independent loading, unavailable-key, provider-error, and manual retry states. Judge0 actions continue working if Gemini fails.
- Invalidate commentary when its analyzed snapshot changes and ignore late responses. AI advice will not overwrite diagnostics, corrected source, output, or saved history.
- Limit the first version to Java and live analysis; do not claim historical or simulated results are compiler-confirmed.

## Technical approach
- Use a new TanStack Start POST server function and server-only Gemini helper, rather than a new Edge Function: this project's supported app-internal server boundary is createServerFn.
- Read GEMINI_API_KEY exclusively inside the server function handler; send it to Google's Gemini API through a private request header. No client variables, key storage, key-returning endpoints, or key logging.
- Validate and bound source/diagnostics, add a separate best-effort rate limit, use a finite request timeout without automatic inference retries, and return safe errors.
- Confirm a currently supported Gemini model before implementation; no key or model access will be assumed.
- Render validated structured output as escaped React text. Treat source and provider output as untrusted input.
- Keep the existing Judge0 runner, language registry, routes, analysis service, and history schema intact.

## Verification
- Add focused tests for input validation, missing-key behavior, safe provider failures, and AI/Judge0 separation.
- Check panel loading, failure/retry, and stale-response behavior in the browser on desktop and mobile.
- Verify a real Java run still produces Judge0 output. Verify Gemini explanations end-to-end only after your secret is saved; report any provider/quota blocker explicitly.
- Publishing is required for new secrets and code to reach the published app.
