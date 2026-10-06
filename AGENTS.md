# AGENTS.md — Logseq Playlist Plugin

## 1. Purpose

This file controls how agents work in this repo.
Follow these rules for all changes.
The project goal is in `docs/IMPLEMENTATION_PLAN.md`.
The progress record is in `docs/PROGRESS.md`.

## 2. TDD Workflow (mandatory)

Do all work in this order. Do not skip steps.

1. READ the plan in `docs/IMPLEMENTATION_PLAN.md`.
2. FIND the smallest next task in `docs/PROGRESS.md`.
3. WRITE one failing test in `tests/*.test.ts`.
4. RUN the test with `npm test`. Confirm it fails.
5. WRITE the minimum source code to pass the test.
6. RUN `npm test` again. Confirm all tests pass.
7. RUN `npm run build`. Confirm the build passes.
8. UPDATE `docs/PROGRESS.md`. Mark the task complete.

Rules:

- One task at a time. Keep each change small.
- Do not add code without a failing test first.
- Do not add a new dependency without user approval.
- Prefer plain DOM. Do not use a UI framework.
- Prefer standard library. Reuse existing helpers.

## 3. Writing Style (ASD-STE100, 80%)

Write all docs in clear and simple English.
Follow these rules where possible:

- Use short sentences. Limit each sentence to 20 words.
- Use one instruction per sentence.
- Use simple verbs: make, add, test, fix, check, run, show.
- Do not use complex clauses. Do not use idioms.
- Use lists for steps. Use present tense.
- Names of files, functions, and commands stay exact.

This is 80% compliance. Clarity has priority over strict compliance.

## 4. Project Rules

- Stack: TypeScript + Vite + `@logseq/libs`.
- Entry file: `src/main.ts`.
- Pure logic lives in `src/playlist.ts`. Keep it free of Logseq APIs.
- Logseq APIs stay in `src/main.ts` only. This keeps logic testable.
- Style with `logseq.provideStyle`. Use `var(--ls-*)` vars.
- Do not add inline iframe player in V1. V1 shows card only.
- Test matrix: public playlist, `watch+list` URL, private URL, single video.

## 5. Test Commands

- `npm test` — runs Vitest unit tests.
- `npm run build` — runs TypeScript check and Vite build.
- Manual test — load unpacked plugin in Logseq Desktop.

## 6. Definition of Done

- All unit tests pass.
- Build passes with no errors.
- `docs/PROGRESS.md` shows current state.
- No change to single-video `{{video}}` behavior.
