# PROGRESS.md — Progress Report

## Status

- Date: 2026-10-06.
- Phase: V1 complete and verified. V2 (YouTube Data API v3 integration) planned and approved.
- Tests: 34 pass. Build passes.
- User approved V2 UI design from `docs/v2-data-api-mock.html`.
- Implementation plan updated in `docs/IMPLEMENTATION_PLAN.md`.

---

## Tasks

### V1 — Core Card & oEmbed
- [x] Step 1: Write `AGENTS.md` with TDD workflow.
- [x] Step 2: Make this progress file.
- [x] Step 3: Make project scaffold (`package.json`, `tsconfig`, `vite.config`, `manifest.json`).
- [x] Step 4: Add `parsePlaylistId` with tests.
- [x] Step 5: Add oEmbed fetch with cache and timeout, with tests.
- [x] Step 6: Add card HTML and embed URL helpers, with tests.
- [x] Step 7: Add `src/main.ts` with Logseq wiring.
- [x] Step 8: Run `npm test` and `npm run build`. Fix errors.
- [x] Step 9: Test manually in Logseq Desktop. Verified with `test_graph`.

### V2 — YouTube Data API Integration
- [ ] Step 10: Register `youtubeApiKey` setting schema in `src/main.ts`.
- [ ] Step 11: Write unit tests and implement YouTube Data API client & cache in `src/playlist.ts`.
- [ ] Step 12: Write unit tests and implement V2 card templates (count badge, quick-picker, tracklist).
- [ ] Step 13: Add CSS for quick-picker, tracklist, and search modal in `src/style.css`.
- [ ] Step 14: Implement Logseq model actions (`addVideoFromSelect`, `importAllVideos`, `addVideoRowNote`).
- [ ] Step 15: Implement slash command `/Insert playlist video` search modal.
- [ ] Step 16: Run all unit tests and production build.
- [ ] Step 17: Test manually in Logseq Desktop.

---

## Files

- `src/playlist.ts` holds pure logic. It has no Logseq calls.
- `src/main.ts` holds Logseq calls and settings schema.
- `src/style.css` holds card and modal styles. It uses `var(--ls-*)` vars.
- `tests/playlist.test.ts` checks URL parse and helpers.
- `tests/playlist-meta.test.ts` checks oEmbed fetch, cache, and card HTML.
- `tests/renderer.test.ts` checks macro arg select and no-iframe rule.
- `docs/IMPLEMENTATION_PLAN.md` documents technical design and architecture.
- `docs/v2-data-api-mock.html` provides interactive UI reference.

---

## Test Matrix

- [x] Public playlist: `PLosJChMwPtizq2swoD8DZXc567PJ9YKnn`. Live oEmbed returns title and thumb.
- [x] URL type `watch?v=x&list=y` shows card. Unit test covers it.
- [x] Private URL shows fallback card. Unit test covers oEmbed 404.
- [x] Single video URL does not trigger card. Unit test covers it.
- [x] Card works in light theme and dark theme. Static proof with Logseq vars.
- [x] Load in Logseq Desktop. Verified with `test_graph` on page `Yt Playlist Test`.
- [ ] YouTube Data API returns total video count.
- [ ] YouTube Data API returns first 50 playlist items.
- [ ] API failure or empty key gracefully falls back to oEmbed.
- [ ] Quick video selector generates child note block.
- [ ] Import All generates hierarchical note blocks.

---

## Notes

- V1 uses oEmbed with zero keys required.
- V2 uses `youtubeApiKey` for total counts, full video lists, and quick referencing.
- API results are cached in `localStorage` under `yt-api-playlist:{id}` to conserve quota.
