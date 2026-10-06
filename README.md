# YouTube Playlist Card for Logseq

Paste a YouTube playlist URL in Logseq. Get a compact card with title,
channel, thumbnail, and video count. Expand it for the tracklist. Create
note blocks for single videos or the whole playlist.

No inline player. Use `Open in YouTube` for playback.

## Features

- Compact card: thumbnail, `PLAYLIST` badge, video-count overlay, title, channel.
- Works with no API key: title, channel, and thumbnail via YouTube oEmbed.
- Optional YouTube Data API v3 key unlocks:
  - Total video count on the card.
  - Quick video picker on the card face with `+ Add Note`.
  - Expandable tracklist (first 50 videos) with per-row `+ Note`.
  - `Import All` to create one note block per video.
  - `/Insert playlist video` slash command with title search.
- Auto-converts `{{video <playlist-url>}}` blocks to playlist cards.
  Single-video `{{video}}` blocks are never touched.
- Private or deleted playlists show a fallback card with `Open in YouTube`.
- API results are cached locally to save quota.
- Light and dark theme support via Logseq CSS variables.

## Known limits

- Tracklist shows the first 50 videos per playlist (API page cap).
- No inline playback. Cards never embed an iframe.
- Basic cards (no API key) show one track entry with a Settings prompt.

## Use

- Renderer macro: `{{renderer :yt-playlist, PLAYLIST_URL}}`.
- Or paste `{{video PLAYLIST_URL}}` where the URL contains `list=`.
- Or slash command `YouTube playlist card` (inserts a starter macro).
- Or right-click a block with a playlist link, pick `Playlist → card`.
- Supported URLs: `youtube.com` (`www`, `m`, `music`), `youtu.be`,
  `youtube-nocookie.com`, `watch?v=x&list=y`, `playlist?list=y`.

## API key setup (optional)

Basic cards work without a key. A key adds counts, the picker, and import.

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project or select an existing project.
3. Open **APIs & Services → Library**.
4. Search for **YouTube Data API v3** and click **Enable**.
5. Open **APIs & Services → Credentials**.
6. Click **+ Create Credentials → API key**.
7. Click **Edit API key** to set restrictions:
   - Set **Application restrictions** to **None** (required for desktop apps).
   - Set **API restrictions** to **Restrict key** and select **YouTube Data API v3**.
8. Click **Save** (Google changes may take up to 5 minutes).
9. Copy the key.
10. Open the plugin settings in Logseq, paste the key, reopen the page.

## Privacy

- On render the plugin calls `youtube.com/oembed` with the playlist URL.
- With a key set it also calls `googleapis.com/youtube/v3` (2 quota units
  per playlist, cached after the first fetch).
- No tracking. No other network calls. Title and thumbnail stay in local cache.

## Install

- Logseq Desktop → Plugins → Marketplace → search `YouTube Playlist Card`.
- Or load unpacked: clone this repo, run `npm install && npm run build`,
  then `Load unpacked plugin` and pick the repo folder.

## Develop

- Run `npm test` for unit tests (Vitest, 77 tests).
- Run `npm run build` for type check plus production bundle.
- Pure logic lives in `src/playlist.ts` (no Logseq APIs).
- Logseq wiring lives in `src/main.ts`. Styles live in `src/style.css`.

## License

MIT. See `LICENSE`.
