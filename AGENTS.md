<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Code execution for all languages goes through src/lib/execute.server.ts (Judge0, base64 I/O); the language registry lives in src/lib/languages.ts — add new languages there so editor, analyzer and /api/execute stay in sync.
- Use TanStack Start server functions for new app-internal secret-backed integrations; Lovable Cloud supplies secure runtime secrets without introducing separate Edge Functions.
