export interface PlaylistMeta {
  id: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  sourceUrl: string;
}

const CACHE_PREFIX = "yt-playlist:";
const OEMBED_TIMEOUT_MS = 8000;

export function parsePlaylistId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim().replace(/^"(.*)"$/, "$1"));
    if (!/^(www\.|music\.)?youtube\.com$/.test(u.hostname) && u.hostname !== "youtu.be") {
      if (!u.hostname.endsWith("youtube.com")) return null;
    }
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
    .replace(/"/g, "&quot;");
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

export function noteBlockContent(title: string, videoUrl: string): string {
  return `### ${title}\n{{video ${videoUrl}}}\n`;
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
  const track = expanded
    ? `<details class="ytpl-details" open>
        <summary class="ytpl-summary"><span class="ytpl-chevron">▴</span> Collapse</summary>
        <div class="ytpl-track">
        ${thumb ? `<img class="ytpl-track-img" src="${thumb}" alt="Playlist thumbnail" />` : ""}
        <div class="ytpl-track-info"><div class="ytpl-track-title">${t}</div>
        <div class="ytpl-track-meta">Playlist • Open in YouTube for full list</div></div>
      </div>
      <div class="ytpl-note">V1 shows one entry. Full list needs API key (V2).</div></details>`
    : `<details class="ytpl-details">
        <summary class="ytpl-summary"><span class="ytpl-chevron">▾</span> Expand</summary>
        <div class="ytpl-track">
        ${thumb ? `<img class="ytpl-track-img" src="${thumb}" alt="Playlist thumbnail" />` : ""}
        <div class="ytpl-track-info"><div class="ytpl-track-title">${t}</div>
        <div class="ytpl-track-meta">Playlist • Open in YouTube for full list</div></div>
      </div>
      <div class="ytpl-note">V1 shows one entry. Full list needs API key (V2).</div></details>`;
  return `<div class="ytpl-card">
    <div class="ytpl-main">
    <div class="ytpl-thumb">${thumb ? `<img src="${thumb}" alt="Playlist thumbnail for ${t}" />` : ""}
      <div class="ytpl-badge"><span class="ytpl-badge-icon">▶</span> PLAYLIST</div>
      <div class="ytpl-count"><span class="ytpl-count-icon">☰</span><span class="ytpl-count-label">PLAYLIST</span></div>
    </div>
    <div class="ytpl-info">
      <div class="ytpl-title">${t}</div>
      <div class="ytpl-meta">${a} • YouTube Playlist</div>
      <div class="ytpl-actions">
        <button class="ytpl-btn ytpl-btn-primary" data-on-click="openYouTube" data-url="${src}"><span class="ytpl-icon">↗</span> Open in YouTube</button>
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
      <button class="ytpl-btn" data-on-click="openYouTube" data-url="${src}">Open in YouTube</button>
    </div></div>
  </div>`;
}

/**
 * Convert `{{video URL}}` to `{{renderer :yt-playlist, URL}}` when URL has a
 * playlist ID. Returns null if no conversion is needed.
 */
export function convertVideoToRenderer(content: string): string | null {
  const match = content.match(/\{\{video\s+(https?:\/\/[^\s}]+)\}\}/);
  if (!match) return null;
  const url = match[1];
  if (!parsePlaylistId(url)) return null;
  return content.replace(match[0], `{{renderer :yt-playlist, ${url}}}`);
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


