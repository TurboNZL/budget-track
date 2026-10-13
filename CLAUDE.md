# BudgetTrack: project handoff

Read this first. It is the running state and decision log: update it whenever a decision or the state changes.

## Engine
This app is pinned to TurboNZL/turboengine (see `.turboengine.json`). The engine is a **reference, not a dependency**, with one exception: the theme package (`turboengine/themes`, npm name `turbothemes`) is installed through `package.json` as `github:TurboNZL/turboengine#<commit>&path:/themes`. The old `TurboNZL/turbothemes` repository is retired; do not point anything at it. Before building something every app would want, look in the engine's `modules/` first. If you improve something that came from it, say so in the session log so it can be ported back.

Taking a newer engine is deliberate: change the commit in `package.json`, run `pnpm install`, check the picker and a few UI styles, then update `engine.ref` in `.turboengine.json`. Themes themselves update at run time from `themes/dist` on turboengine `main`, with no app release.

## User preferences (how to work with them)
- Don't waste their usage. Fact-check and double-check yourself; use web search liberally.
- They write casually; reply in normal capitalised prose.
- Put effort into verifying against real runs, not only unit tests.
- A merged PR cannot take new work: restart the branch from main for follow-up changes. Commit trailers as the harness gives them.

## Decisions made (don't re-ask)
| Topic | Decision |
|---|---|
| Engine modules | Browser-only app: only the themes are used. The updaters, window-frame, editions, android-shell and release-pipeline modules do not apply (no Electron, no server, no Android). |
| Theme glue | `src/lib/themes.ts` (starts the engine, `storagePrefix: budget-track`, chart colours) and `AppearanceCard.tsx`; layouts are not used. |

## Session log
- Moved the `turbothemes` dependency from the retired turbothemes repository to turboengine `themes/` (commit pinned in `package.json`, lockfile resolves through codeload so CI can fetch it), added `.turboengine.json`, this file, and updated the wording that named the old repository.
