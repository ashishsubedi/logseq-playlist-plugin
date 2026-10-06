export interface VideoItem {
  id: string;
  title: string;
  position: number;
  thumbnailUrl: string;
  videoUrl: string;
}

export interface PlaylistMeta {
  id: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  sourceUrl: string;
  videoCount?: number;
  items?: VideoItem[];
}

const CACHE_PREFIX = "yt-playlist:";
const OEMBED_TIMEOUT_MS = 8000;


const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function isYouTubeHost(hostname: string): boolean {
  return YOUTUBE_HOSTS.has(hostname.toLowerCase());
}

export function parsePlaylistId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim().replace(/^"(.*)"$/, "$1"));
    if (!isYouTubeHost(u.hostname)) return null;
    const id = u.searchParams.get("list");
    return id && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function buildOEmbedUrl(playlistUrl: string): string {
  return (
    "https://www.youtube.com/oembed?url=" +
    encodeURIComponent(playlistUrl) +
    "&format=json"
  );
}

export function buildEmbedUrl(playlistId: string): string {
  return (
    "https://www.youtube.com/embed/videoseries?list=" +
    encodeURIComponent(playlistId)
  );
}

export function buildYouTubeApiPlaylistUrl(playlistId: string, apiKey: string): string {
  return `https://www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&id=${encodeURIComponent(
    playlistId
  )}&key=${encodeURIComponent(apiKey)}`;
}

export function buildYouTubeApiItemsUrl(playlistId: string, apiKey: string): string {
  return `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet%2CcontentDetails&playlistId=${encodeURIComponent(
    playlistId
  )}&maxResults=50&key=${encodeURIComponent(apiKey)}`;
}

export interface YouTubePlaylistSnippetResponse {
  items?: Array<{
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
    contentDetails?: {
      itemCount?: number;
    };
  }>;
}

export interface YouTubePlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      title?: string;
      position?: number;
      resourceId?: { videoId?: string };
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
}

export function parseYouTubePlaylistResponse(
  data: YouTubePlaylistSnippetResponse
): { title: string; author: string; thumbnailUrl: string; videoCount: number } | null {
  const item = data.items?.[0];
  if (!item || !item.snippet) return null;
  const s = item.snippet;
  const thumb =
    s.thumbnails?.high?.url ??
    s.thumbnails?.medium?.url ??
    s.thumbnails?.default?.url ??
    "";
  return {
    title: s.title ?? "YouTube Playlist",
    author: s.channelTitle ?? "YouTube",
    thumbnailUrl: thumb,
    videoCount: item.contentDetails?.itemCount ?? 0,
  };
}

export function parseYouTubePlaylistItemsResponse(
  data: YouTubePlaylistItemsResponse
): VideoItem[] {
  if (!data.items) return [];
  const results: VideoItem[] = [];
  for (const item of data.items) {
    const s = item.snippet;
    const vidId = s?.resourceId?.videoId;
    if (!vidId) continue;
    const thumb =
      s?.thumbnails?.medium?.url ??
      s?.thumbnails?.high?.url ??
      s?.thumbnails?.default?.url ??
      `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`;
    results.push({
      id: vidId,
      title: s?.title ?? "Untitled Video",
      position: s?.position ?? results.length,
      thumbnailUrl: thumb,
      videoUrl: `https://www.youtube.com/watch?v=${vidId}`,
    });
  }
  return results;
}


export function selectPlaylistUrl(args: string[]): string | null {
  const list = args[0]?.trim() === ":yt-playlist" ? args.slice(1) : args;
  for (const a of list) {
    const t = a.trim().replace(/^"(.*)"$/, "$1");
    if (/^https?:\/\//.test(t) && parsePlaylistId(t)) return t;
  }
  return null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow only https:// URLs so callers never pass javascript:/data: to openExternalLink. */
export function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "https:") return false;
    return isYouTubeHost(u.hostname);
  } catch {
    return false;
  }
}

function cacheKey(id: string): string {
  return CACHE_PREFIX + id;
}

const memCache = new Map<string, string>();

function storage(): Storage | null {
  try {
    const g = globalThis as unknown as { localStorage?: Storage };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readCache(id: string): PlaylistMeta | null {
  try {
    const store = storage();
    const raw = store ? store.getItem(cacheKey(id)) : memCache.get(cacheKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as PlaylistMeta;
  } catch {
    return null;
  }
}

export function writeCache(meta: PlaylistMeta): void {
  try {
    const store = storage();
    if (store) store.setItem(cacheKey(meta.id), JSON.stringify(meta));
    else memCache.set(cacheKey(meta.id), JSON.stringify(meta));
  } catch {
    // ponytail: ignore quota errors, cache is best-effort
  }
}

export function clearCacheForTests(): void {
  memCache.clear();
  try {
    storage()?.clear?.();
  } catch {
    // ignore
  }
}

export function getAllCachedPlaylists(): PlaylistMeta[] {
  const map = new Map<string, PlaylistMeta>();
  try {
    const store = storage();
    if (store) {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          const raw = store.getItem(k);
          if (raw) {
            try {
              const meta = JSON.parse(raw) as PlaylistMeta;
              if (meta && meta.id) map.set(meta.id, meta);
            } catch {
              // ignore malformed JSON
            }
          }
        }
      }
    }
    for (const [k, v] of memCache.entries()) {
      if (k.startsWith(CACHE_PREFIX)) {
        try {
          const meta = JSON.parse(v) as PlaylistMeta;
          if (meta && meta.id && !map.has(meta.id)) map.set(meta.id, meta);
        } catch {
          // ignore malformed JSON
        }
      }
    }
  } catch {
    // best-effort
  }
  return Array.from(map.values());
}

export function searchCachedVideos(
  query: string,
  limit = 20
): Array<{ playlist: PlaylistMeta; video: VideoItem }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: Array<{ playlist: PlaylistMeta; video: VideoItem }> = [];
  const playlists = getAllCachedPlaylists();
  for (const pl of playlists) {
    if (!pl.items) continue;
    for (const item of pl.items) {
      if (
        item.title.toLowerCase().includes(q) ||
        pl.title.toLowerCase().includes(q)
      ) {
        matches.push({ playlist: pl, video: item });
        if (matches.length >= limit) return matches;
      }
    }
  }
  return matches;
}


export async function fetchYouTubeApiMeta(
  playlistUrl: string,
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<PlaylistMeta | null> {
  const id = parsePlaylistId(playlistUrl);
  if (!id || !apiKey) return null;
  const cached = readCache(id);
  if (cached && cached.items && cached.items.length > 0) return cached;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), OEMBED_TIMEOUT_MS);
  try {
    const playlistReq = fetcher(buildYouTubeApiPlaylistUrl(id, apiKey), {
      signal: ctrl.signal,
    });
    const itemsReq = fetcher(buildYouTubeApiItemsUrl(id, apiKey), {
      signal: ctrl.signal,
    });

    const [playlistRes, itemsRes] = await Promise.all([playlistReq, itemsReq]);
    if (!playlistRes.ok) return null;

    const playlistJson = (await playlistRes.json()) as YouTubePlaylistSnippetResponse;
    const parsedPlaylist = parseYouTubePlaylistResponse(playlistJson);
    if (!parsedPlaylist) return null;

    let items: VideoItem[] = [];
    if (itemsRes.ok) {
      const itemsJson = (await itemsRes.json()) as YouTubePlaylistItemsResponse;
      items = parseYouTubePlaylistItemsResponse(itemsJson);
    }

    const meta: PlaylistMeta = {
      id,
      title: parsedPlaylist.title,
      author: parsedPlaylist.author,
      thumbnailUrl: parsedPlaylist.thumbnailUrl,
      sourceUrl: playlistUrl,
      videoCount: parsedPlaylist.videoCount,
      items,
    };
    writeCache(meta);
    return meta;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}


export async function fetchPlaylistMeta(
  playlistUrl: string,
  fetcher: typeof fetch = fetch
): Promise<PlaylistMeta | null> {
  const id = parsePlaylistId(playlistUrl);
  if (!id) return null;
  const cached = readCache(id);
  if (cached) return cached;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), OEMBED_TIMEOUT_MS);
  try {
    const res = await fetcher(buildOEmbedUrl(playlistUrl), {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    if (!data.title) return null;
    const meta: PlaylistMeta = {
      id,
      title: data.title,
      author: data.author_name ?? "YouTube",
      thumbnailUrl: data.thumbnail_url ?? "",
      sourceUrl: playlistUrl,
    };
    writeCache(meta);
    return meta;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchEnrichedPlaylistMeta(
  playlistUrl: string,
  apiKey?: string | null,
  fetcher: typeof fetch = fetch
): Promise<PlaylistMeta | null> {
  if (apiKey && apiKey.trim().length > 0) {
    const apiMeta = await fetchYouTubeApiMeta(playlistUrl, apiKey.trim(), fetcher);
    if (apiMeta) return apiMeta;
  }
  return fetchPlaylistMeta(playlistUrl, fetcher);
}


export function noteBlockContent(title: string, videoUrl: string): string {
  const clean = title.replace(/[\r\n]+/g, " ").trim() || "Video";
  return `### ${clean}\n{{video ${videoUrl}}}\n`;
}

export function cardTemplate(
  meta: PlaylistMeta,
  slotUuid: string,
  expanded: boolean
): string {
  const t = escapeHtml(meta.title);
  const a = escapeHtml(meta.author);
  const thumb = escapeHtml(meta.thumbnailUrl);
  const src = escapeHtml(meta.sourceUrl);
  const hasItems = Boolean(meta.items && meta.items.length > 0);
  const count = meta.videoCount ?? (hasItems ? meta.items!.length : undefined);

  // Count overlay badge
  const countBadge =
    count !== undefined
      ? `<div class="ytpl-count"><span class="ytpl-count-icon">☰</span><span class="ytpl-count-number">${count}</span><span class="ytpl-count-label">VIDEOS</span></div>`
      : `<div class="ytpl-count"><span class="ytpl-count-icon">☰</span><span class="ytpl-count-label">PLAYLIST</span></div>`;

  // Quick picker dropdown
  const quickPicker = hasItems
    ? `<div class="ytpl-quick-picker">
        <select class="ytpl-select" id="ytpl-sel-${escapeHtml(slotUuid)}">
          <option value="">Select video to reference...</option>
          ${meta.items!
            .map(
              (item) =>
                `<option value="${escapeHtml(item.id)}" data-url="${escapeHtml(
                  item.videoUrl
                )}" data-title="${escapeHtml(item.title)}">${escapeHtml(
                  item.title
                )}</option>`
            )
            .join("")}
        </select>
        <button class="ytpl-btn ytpl-btn-action" data-on-click="addVideoFromSelect" data-slot-uuid="${escapeHtml(
          slotUuid
        )}">+ Add Note</button>
      </div>`
    : "";

  // Action buttons
  const importBtn = hasItems
    ? `<button class="ytpl-btn" data-on-click="importAllVideos" data-slot-uuid="${escapeHtml(
        slotUuid
      )}" data-playlist-id="${escapeHtml(meta.id)}">↓ Import All (${count})</button>`
    : "";

  // Details tracklist
  let track = "";
  if (hasItems) {
    const summaryText = count !== undefined ? `View All ${count} Videos` : "View All Videos";
    const rowsHtml = meta.items!
      .map(
        (item, idx) => `
        <div class="ytpl-track-row">
          <span class="ytpl-track-num">#${idx + 1}</span>
          ${
            item.thumbnailUrl
              ? `<img class="ytpl-track-thumb" src="${escapeHtml(
                  item.thumbnailUrl
                )}" alt="${escapeHtml(item.title)}" />`
              : ""
          }
          <div class="ytpl-track-title">${escapeHtml(item.title)}</div>
          <div class="ytpl-track-actions">
            <button class="ytpl-btn" data-on-click="openYouTube" data-url="${escapeHtml(
              item.videoUrl
            )}">↗</button>
            <button class="ytpl-btn ytpl-btn-action" data-on-click="addVideoRowNote" data-slot-uuid="${escapeHtml(
              slotUuid
            )}" data-url="${escapeHtml(item.videoUrl)}" data-title="${escapeHtml(
              item.title
            )}">+ Note</button>
          </div>
        </div>`
      )
      .join("");

    track = `<details class="ytpl-details"${expanded ? " open" : ""}>
      <summary class="ytpl-summary"><span class="ytpl-chevron">▾</span> ${summaryText}</summary>
      <div class="ytpl-tracklist">${rowsHtml}</div>
    </details>`;
  } else {
    track = `<details class="ytpl-details"${expanded ? " open" : ""}>
      <summary class="ytpl-summary"><span class="ytpl-chevron">${expanded ? "▴" : "▾"}</span> ${expanded ? "Collapse" : "Expand"}</summary>
      <div class="ytpl-track">
        ${thumb ? `<img class="ytpl-track-img" src="${thumb}" alt="Playlist thumbnail" />` : ""}
        <div class="ytpl-track-info"><div class="ytpl-track-title">${t}</div>
        <div class="ytpl-track-meta">Playlist • Open in YouTube for full list</div></div>
        <div class="ytpl-track-actions">
          <button class="ytpl-btn" data-on-click="openYouTube" data-url="${src}">↗</button>
        </div>
      </div>
      <div class="ytpl-note">
        <span>Add a YouTube API key in Settings to show all videos.</span>
        <button class="ytpl-btn ytpl-btn-action" data-on-click="openSettings">⚙ Settings</button>
      </div>
    </details>`;
  }

  return `<div class="ytpl-card">
    <div class="ytpl-main">
    <div class="ytpl-thumb">${thumb ? `<img src="${thumb}" alt="Playlist thumbnail for ${t}" />` : ""}
      <div class="ytpl-badge"><span class="ytpl-badge-icon">▶</span> PLAYLIST</div>
      ${countBadge}
    </div>
    <div class="ytpl-info">
      <div>
        <div class="ytpl-title">${t}</div>
        <div class="ytpl-meta">${a} • YouTube Playlist</div>
      </div>
      ${quickPicker}
      <div class="ytpl-actions">
        <button class="ytpl-btn ytpl-btn-primary" data-on-click="openYouTube" data-url="${src}"><span class="ytpl-icon">↗</span> Open in YouTube</button>
        ${importBtn}
        ${!hasItems ? `<button class="ytpl-btn" data-on-click="openSettings"><span class="ytpl-icon">⚙</span> Settings</button>` : ""}
      </div>
    </div>
    </div>${track}
  </div>`;
}


export function fallbackTemplate(playlistUrl: string): string {
  const src = escapeHtml(playlistUrl);
  return `<div class="ytpl-card ytpl-fallback">
    <div class="ytpl-info"><div class="ytpl-title">YouTube Playlist</div>
    <div class="ytpl-meta">Preview unavailable (private or deleted)</div>
    <div class="ytpl-actions">
      <button class="ytpl-btn ytpl-btn-primary" data-on-click="openYouTube" data-url="${src}"><span class="ytpl-icon">↗</span> Open in YouTube</button>
      <button class="ytpl-btn" data-on-click="openSettings"><span class="ytpl-icon">⚙</span> Settings</button>
    </div></div>
  </div>`;
}

/**
 * Convert `{{video URL}}` to `{{renderer :yt-playlist, URL}}` when URL has a
 * playlist ID. Converts every playlist macro in the block. Returns null
 * if no conversion is needed.
 */
export function convertVideoToRenderer(content: string): string | null {
  const re = /\{\{video\s+(https?:\/\/[^\s}]+)\}\}/g;
  let changed = false;
  const next = content.replace(re, (full, url: string) => {
    if (!parsePlaylistId(url)) return full;
    changed = true;
    return `{{renderer :yt-playlist, ${url}}}`;
  });
  return changed ? next : null;
}

export interface BlockLike {
  uuid?: string;
  content?: string;
  title?: string;
  children?: BlockLike[];
}

export function findConvertibleBlocks(
  blocks: BlockLike[]
): Array<{ uuid: string; newContent: string }> {
  const result: Array<{ uuid: string; newContent: string }> = [];
  function recurse(list: BlockLike[]) {
    for (const b of list) {
      const text = b.content ?? b.title;
      if (b.uuid && text) {
        const next = convertVideoToRenderer(text);
        if (next) {
          result.push({ uuid: b.uuid, newContent: next });
        }
      }
      if (b.children && Array.isArray(b.children)) {
        recurse(b.children);
      }
    }
  }
  recurse(blocks);
  return result;
}

export const API_KEY_SETTING_DESCRIPTION = `Optional. Leave empty for basic card (title, channel, thumbnail).
Add a key to get video counts, quick video picker, and bulk import.

How to get a free API key:
1. Open Google Cloud Console (https://console.cloud.google.com).
2. Create a new project or pick an existing project.
3. Go to APIs & Services → Library.
4. Search for "YouTube Data API v3" and click Enable.
5. Go to APIs & Services → Credentials.
6. Click "+ Create Credentials" and pick "API key".
7. Click "Edit API key" to set restrictions:
   • Set Application restrictions to "None" (required for Logseq desktop).
   • Set API restrictions to "Restrict key" and select "YouTube Data API v3".
8. Click Save. Note: Google changes may take up to 5 minutes.
9. Copy your key and paste it here.
10. Reopen the page in Logseq to refresh cards.`;


