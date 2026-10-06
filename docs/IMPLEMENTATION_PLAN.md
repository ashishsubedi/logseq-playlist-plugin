# Logseq YouTube Playlist Plugin — Implementation Plan

This document contains the complete technical plan for the plugin.
Part 1 documents the baseline V1 implementation and design decisions for reference.
Part 2 documents the V2 YouTube Data API v3 integration and seamless referencing.

---

# Part 1: V1 Baseline Implementation (Reference & Regression Guard)

## 1. Problem (verified)
- Plain playlist link in Logseq renders as long ugly URL.
- `{{video https://www.youtube.com/playlist?list=...}}` embeds the full `youtube.com` watch/playlist page in an iframe (Search header, Sign-in button), not a player. Large, unusable.
- Correct player URL per YouTube docs is `https://www.youtube.com/embed/videoseries?list=PLAYLIST_ID` (or `.../embed?listType=playlist&list=ID`).
- Verified: `GET https://www.youtube.com/oembed?url=<playlistUrl>&format=json` returns JSON with `title`, `author_name`, `thumbnail_url`, and `html` containing the correct `embed/videoseries` iframe. No API key required.
- Caveat (verified in mock): inline iframe can fail with YouTube **Error 153** (`Video player configuration error`). Per YouTube Help, Error 153 = blocked playback due to missing HTTP Referer, plus cases where owner disabled embedding or video is age-restricted. `file://` preview has no Referer, so it always 153s there. Logseq (Electron + sandboxed iframe) must be tested separately.
- Decision: **V1 = no-embed flow**. Do not depend on inline playback. Card + expandable tracklist + per-video note blocks + Open-in-YouTube. Optional `Try player` fallback later.

## 2. V1 Goal / Non-goals
- **Goal**: paste a YouTube playlist URL in Logseq, get a compact dark-theme card (title, channel, thumbnail, count) that expands inline to a per-lecture list, each row able to create a Logseq note block.
- **Non-goals (V1)**: no YouTube Data API key, no full tracklist fetch, no auth, no download, no transcript, no playback state sync.

## 3. V1 UX Design
Reference mock: `docs/playlist-card-mock.html`.

- **Collapsed card** (default renderer output):
  - Left: oEmbed thumbnail, `PLAYLIST` badge, count overlay (count = `PLAYLIST` in V1).
  - Right: title, `author • YouTube Playlist`, buttons: `Expand`, `Open in YouTube`.
- **Expanded state**:
  - NO auto iframe in V1. Show info note + tracklist placeholder.
  - V1 tracklist: single entry (the playlist itself) from oEmbed.
  - Each row: thumbnail, title, `Open in YouTube`.
- **Error state**: oEmbed 404 / private playlist → fallback link card with `Open in YouTube`.
- **Logseq theme**: use `var(--ls-*)` CSS vars where available; fallback to `#262626 / #3a3a3a` dark card. Min touch target 44px, visible focus ring, `alt` text on thumbnails.

## 4. V1 Technical Approach & Macro Detection
- Stack: `@logseq/libs` plugin (TypeScript + Vite, plain DOM, no framework).
- Entry points:
  - `logseq.App.onMacroRendererSlotted` — intercept custom `{{renderer :yt-playlist, <url>}}` where URL contains `list=`.
  - `convertVideoToRenderer` + `logseq.DB.onChanged` — auto-converts `{{video <url>}}` containing playlist ID to `{{renderer :yt-playlist, <url>}}`.
  - `logseq.Editor.registerSlashCommand('YouTube playlist card', ...)` — inserts renderer block.
  - `logseq.Editor.registerBlockContextMenu('Playlist → card', ...)` — converts selected playlist link.
- Detection (two-stage, tested):
  - Stage 1 — extract macro URL: `/\{\{\s*video\s+(https?:\/\/[^\s}]+?)\s*\}\}/gi` (tolerates `{{ video}}`, `{{VIDEO}}`, trailing space, multiple macros via `matchAll`; reset `lastIndex` before `.exec`).
  - Stage 2 — playlist check via `new URL()`: host must match `youtube.com|youtu.be|youtube-nocookie.com` (+ `music.youtube.com`) AND `searchParams.get('list')` non-empty. Do NOT use naive `/list=/` substring — it false-positives on `?playlist=X&loop=1` single-video loop embeds and non-YouTube `?list=` URLs.
  - Non-matches (single `watch?v=`, `youtu.be` video, `/embed/ID`, Vimeo, bare links, plain text) are left to native Logseq — no behavior change, no block migration.
- Metadata (no key): `fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json')`. Cache by playlist ID in `localStorage`. Timeout (8s) + fallback.
- Render: `logseq.provideUI({ key, slot, template })` with card HTML. Lazy rendering, no iframe in V1.
- Actions via `logseq.provideModel`:
  - `openYouTube(url)` — `logseq.App.openExternalLink(url)`.
  - Expand uses native `<details>` element to prevent slot re-render state bugs.

---

# Part 2: V2 YouTube Data API v3 Integration (Current Scope)

## 5. Overview & Goals
V2 adds optional YouTube Data API v3 integration to enable enriched metadata and seamless referencing.

### Goals
- Allow users to enter a YouTube Data API v3 key in plugin settings (`youtubeApiKey`).
- Show total video count on the thumbnail overlay badge (e.g. `☰ 28 VIDEOS`).
- Fetch the first 50 videos for the playlist.
- Provide a quick video picker on the card face for zero-click referencing:
  `[ Select video to reference... ▾ ] [ + Add Note ]`
- Provide a one-click `Import All` button to insert hierarchical note blocks.
- Provide a slash command `/Insert playlist video` with a Zotero-style search modal.
- Provide an expanded tracklist with video rows and action buttons (`↗`, `+ Note`).
- Cache API responses in `localStorage` under `yt-api-playlist:{id}` to conserve quota.
- Gracefully fall back to V1 oEmbed card when no API key is provided or on quota error.

### Non-Goals
- Do not auto-embed inline iframes.
- Do not download video files.
- Do not sync playback state with YouTube.
- Do not paginate beyond 50 videos in the initial fetch.

---

## 6. Architecture & Pure Logic Isolation

Follow rules from `AGENTS.md`:
- Pure logic lives in `src/playlist.ts`.
- `src/playlist.ts` has no Logseq API dependencies.
- Logseq API calls live only in `src/main.ts`.
- Styles live in `src/style.css` with `var(--ls-*)` CSS variables.
- Pure functions must pass Vitest unit tests before merging.

---

## 7. Data Models

```ts
export interface VideoItem {
  id: string;          // YouTube video ID
  title: string;       // Video title
  position: number;    // Playlist order (0-indexed)
  thumbnailUrl: string;// Video thumbnail URL
  videoUrl: string;    // https://www.youtube.com/watch?v={id}
}

export interface PlaylistMeta {
  id: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  sourceUrl: string;
  videoCount?: number;      // Total count from API (e.g. 28)
  items?: VideoItem[];       // First 50 videos from API
}
```

---

## 8. YouTube Data API Endpoints & Quota Strategy

### 8.1 Endpoints
1. `playlists.list`:
   - URL: `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id={id}&key={key}`
   - Returns: `contentDetails.itemCount`, `snippet.title`, `snippet.channelTitle`, `snippet.thumbnails`.
   - Cost: 1 quota unit.

2. `playlistItems.list`:
   - URL: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId={id}&maxResults=50&key={key}`
   - Returns: `snippet.title`, `snippet.resourceId.videoId`, `snippet.thumbnails`, `snippet.position`.
   - Cost: 1 quota unit.

### 8.2 Quota and Caching Strategy
- Store API results in `localStorage` under key `yt-api-playlist:{id}`.
- Use in-memory map fallback when `localStorage` is unavailable.
- Fetch only once per playlist per session.
- Abort fetch after 8 seconds.
- On error or quota limit, fall back to oEmbed metadata.

---

## 9. UI & Interaction Design

Reference mockup: `docs/v2-data-api-mock.html`.

### 9.1 Collapsed Card
- Thumbnail shows `☰ {count} VIDEOS` badge when count is available.
- Quick video selector dropdown appears on the card face:
  `[ Choose video to reference... ▾ ] [ + Add Note ]`
- Action buttons:
  - `↗ Open in YouTube`
  - `↓ Import All ({count})`
- Clicking `+ Add Note` inserts a child block under the playlist.

### 9.2 Expanded Tracklist
- `<details>` element with `▾ View All {count} Videos`.
- Lists video rows sorted by position.
- Each row shows:
  - Video index (`#1`, `#2`, ...).
  - Thumbnail preview.
  - Video title.
  - `↗` button (opens in YouTube).
  - `+ Note` button (inserts child block).

### 9.3 Slash Command Search Modal (`/Insert playlist video`)
- Opens search input modal when typed in any block (Zotero-style).
- Filters videos across cached playlists.
- User selects item to insert hierarchical note block at cursor.

### 9.4 Hierarchical Block Format
```markdown
- {{renderer :yt-playlist, https://...}}
  - ### 03. ISPC & SIMD Execution
    {{video https://www.youtube.com/watch?v=VIDEO_ID}}
```

---

## 10. Implementation Steps (TDD Workflow)

### Phase 1: Settings Schema
- Add `youtubeApiKey` to `logseq.useSettingsSchema` in `src/main.ts`.
- Pass setting value to metadata fetchers.

### Phase 2: API Client & Caching (Pure Logic)
- Write tests in `tests/youtube-api.test.ts`.
- Check URL builders.
- Check parsing for playlist count and video items.
- Check error and quota fallbacks.
- Implement functions in `src/playlist.ts`.
- Run `npm test`.

### Phase 3: Card & Quick-Picker Templates
- Write tests in `tests/card-v2.test.ts`.
- Check count badge markup.
- Check quick selector dropdown markup.
- Check expanded tracklist markup.
- Ensure no iframe rule passes.
- Implement template helpers in `src/playlist.ts`.
- Add CSS in `src/style.css`.
- Run `npm test`.

### Phase 4: Model Actions & Slash Command
- Add `addVideoFromSelect` action.
- Add `addVideoRowNote` action.
- Add `importAllVideos` action.
- Add `/Insert playlist video` slash command with quick search dialog.
- Listen for `logseq.onSettingsChanged`.

### Phase 5: Verification & Documentation
- Run `npm test` and `npm run build`.
- Test in Logseq Desktop with test graph.
- Update `docs/PROGRESS.md`.

---

## 11. Host CSS Regression Guards (Logseq Desktop)

Card HTML renders inline in the Logseq document. Host styles leak in.
These bugs regressed twice. The rules below are locked by `tests/style.test.ts`.
Do not remove them without a live Logseq check.

### 11.1 `white-space: pre-wrap` leak (worst offender)
- Symptom: ~90px voids between title and channel line, and ~100px dead space below the toggle.
- Cause: Logseq sets `white-space: pre-wrap` on block content. It inherits into the card. Indented template newlines render as line breaks.
- Guard: `.ytpl-card { white-space: normal; }`. One rule covers all children.

### 11.2 Flex stretch from host wrappers
- Symptom: card absorbs excess slot height, large empty box below content.
- Guards: `.ytpl-card { height: fit-content; max-height: fit-content; align-self: flex-start; }`.
- Guards: `logseq.provideUI` passes `style: { height: "fit-content", minHeight: "0" }`.
- Guard: `.ytpl-details { height: auto; max-height: fit-content; }`.

### 11.3 Content spread inside the card
- Symptom: title, picker, and buttons spread across a tall card.
- Cause: `justify-content: space-between` distributes free space.
- Guard: `.ytpl-info { justify-content: flex-start; gap: 8px; }`.
- Guard: no `margin-top: auto` inside the card. Buttons stay packed under the picker.

### 11.4 Margin and image overrides
- Guard: `.ytpl-card div, .ytpl-card summary { margin: 0; }`. Host margins cannot inject gaps.
- Guard: `.ytpl-card .ytpl-thumb img { max-width: none; object-fit: cover; }`. Thumbnails always fill.
- Guard: `.ytpl-thumb { align-self: flex-start; }`. Flex stretch cannot warp the thumbnail.

### 11.5 Primary button accent (user preference)
- `.ytpl-btn-primary` keeps the red accent (`rgba(255, 0, 51, ...)`).
- A past polish pass neutralized it. The user asked to bring it back.
- Locked by test: "restores red accent on the primary Open in YouTube button".
