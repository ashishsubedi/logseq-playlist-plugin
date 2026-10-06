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

## Limits (V1)

- V1 shows no inline player. Use `Open in YouTube`.
- V1 shows one track entry. Full list needs API key (V2).
