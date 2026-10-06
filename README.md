# YouTube Playlist Card for Logseq

Paste a YouTube playlist URL. Get a small card. Expand the card. Make note blocks.

## Use

- Type `{{renderer :yt-playlist, PLAYLIST_URL}}`.
- Or type `{{video PLAYLIST_URL}}` with a `list=` URL.
- Or use slash command `YouTube playlist card`.
- Or right-click a block with a playlist link. Pick `Playlist → card`.

## Privacy

- The plugin calls `youtube.com/oembed` on render only.
- The plugin sends the playlist URL to YouTube.
- The plugin uses no API key. The plugin stores title and thumbnail in local cache.

## Test

- Run `npm test`.
- Run `npm run build`.
- Load the unpacked folder in Logseq Desktop.

## API Key Setup (Optional)

Basic cards work without an API key.
An API key enables video counts, the video selector, and bulk import.

To create a free API key:
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
9. Copy your API key.
10. Open plugin settings in Logseq, paste the key, and reopen the page.

## Limits (V1)

- V1 shows no inline player. Use `Open in YouTube`.
- Basic cards without an API key show one track entry.
