import "@logseq/libs";
import css from "./style.css?raw";
import {
  cardTemplate,
  escapeHtml,
  fallbackTemplate,
  fetchEnrichedPlaylistMeta,
  findConvertibleBlocks,
  isSafeExternalUrl,
  noteBlockContent,
  parsePlaylistId,
  readCache,
  searchCachedVideos,
  selectPlaylistUrl,
  type BlockLike,
  API_KEY_SETTING_DESCRIPTION,
} from "./playlist";

function getApiKey(): string {
  const settings = logseq.settings as { youtubeApiKey?: string } | undefined;
  return (settings?.youtubeApiKey ?? "").trim();
}

function rendererArgs(payload: { arguments?: string[] }): string[] {
  return payload.arguments ?? [];
}

async function renderCard(slot: string, blockUuid: string, url: string) {
  const id = parsePlaylistId(url);
  if (!id) return;
  try {
    const apiKey = getApiKey();
    const meta = await fetchEnrichedPlaylistMeta(url, apiKey);
    const key = `ytpl-${id}-${slot}`;
    const template = meta
      ? cardTemplate(meta, blockUuid, false)
      : fallbackTemplate(url);
    logseq.provideUI({
      key,
      slot,
      reset: true,
      template,
      style: {
        height: "fit-content",
        minHeight: "0",
      },
    });
  } catch (err) {
    console.error("[yt-playlist] renderCard failed", err);
  }
}

function registerRenderer() {
  logseq.App.onMacroRendererSlotted(({ slot, payload }) => {
    const args = rendererArgs(payload as unknown as { arguments?: string[] });
    // ponytail: single-video URLs return null here, native handling stays intact
    const url = selectPlaylistUrl(args);
    if (!url) return;
    const blockUuid =
      (payload as unknown as { uuid?: string }).uuid ?? slot;
    void renderCard(slot, blockUuid, url);
  });
}

async function addNote(slotUuid: string, url: string, title: string) {
  const content = noteBlockContent(title || "Playlist note", url);
  try {
    await logseq.Editor.insertBlockAsChild(slotUuid, content);
  } catch {
    const page = await logseq.Editor.getCurrentPage();
    const name = (page as { name?: string } | null)?.name;
    if (name) await logseq.Editor.appendBlockInPage(name, content);
  }
}

function registerModel() {
  logseq.provideModel({
    async openYouTube(e: { dataset: { url?: string } }) {
      const url = (e.dataset.url ?? "").trim();
      if (!url || !isSafeExternalUrl(url)) return;
      try {
        await logseq.App.openExternalLink(url);
      } catch {
        window.open(url, "_blank", "noopener");
      }
    },
    openSettings() {
      try {
        logseq.showSettingsUI();
      } catch {
        void logseq.UI.showMsg(
          "Open Plugins → logseq-playlist-plugin → Settings to add your API key."
        );
      }
    },
    async addVideoFromSelect(e: { dataset: { slotUuid?: string } }) {
      const { slotUuid } = e.dataset;
      if (!slotUuid) return;
      const sel = parent.document.getElementById(
        `ytpl-sel-${slotUuid}`
      ) as HTMLSelectElement | null;
      if (!sel || !sel.value) {
        await logseq.UI.showMsg("Please select a video from the dropdown first.", "warning");
        return;
      }
      const opt = sel.selectedOptions[0];
      const url = opt.getAttribute("data-url");
      const title = opt.getAttribute("data-title");
      if (!url) return;
      await addNote(slotUuid, url, title ?? "Video");
    },
    async addVideoRowNote(e: {
      dataset: { slotUuid?: string; url?: string; title?: string };
    }) {
      const { slotUuid, url, title } = e.dataset;
      if (!slotUuid || !url) return;
      await addNote(slotUuid, url, title ?? "Video");
    },
    async importAllVideos(e: {
      dataset: { slotUuid?: string; playlistId?: string };
    }) {
      const { slotUuid, playlistId } = e.dataset;
      if (!slotUuid || !playlistId) return;
      const meta = readCache(playlistId);
      if (!meta || !meta.items || meta.items.length === 0) {
        await logseq.UI.showMsg("No video list available to import.", "warning");
        return;
      }
      for (const item of meta.items) {
        try {
          const content = noteBlockContent(item.title, item.videoUrl);
          await logseq.Editor.insertBlockAsChild(slotUuid, content);
        } catch (err) {
          console.error("[yt-playlist] importAllVideos skipped one item", err);
        }
      }
      await logseq.UI.showMsg(`Imported ${meta.items.length} videos as notes.`);
    },
    async insertSearchResult(e: {
      dataset: { url?: string; title?: string };
    }) {
      const { url, title } = e.dataset;
      if (!url || !isSafeExternalUrl(url)) return;
      const content = noteBlockContent(title ?? "Video", url);
      await logseq.Editor.insertAtEditingCursor(content);
      logseq.provideUI({ key: "ytpl-search-modal", template: "" });
    },
    async closeSearchModal() {
      logseq.provideUI({ key: "ytpl-search-modal", template: "" });
    },
  });
}

function openSearchModal() {
  const modalTemplate = `
    <div class="ytpl-modal-overlay" data-on-click="closeSearchModal">
      <div class="ytpl-modal" onclick="event.stopPropagation()">
        <div class="ytpl-modal-header">
          <span style="font-size: 14px;">🔍</span>
          <input class="ytpl-search-input" id="ytpl-search-input" type="text" placeholder="Search playlist video by title..." autofocus />
        </div>
        <div class="ytpl-search-results" id="ytpl-search-results">
          <div style="font-size: 12px; color: var(--ls-secondary-text-color, #888); padding: 8px;">Type to search cached playlist videos...</div>
        </div>
      </div>
    </div>
  `;

  logseq.provideUI({
    key: "ytpl-search-modal",
    close: "outside",
    template: modalTemplate,
  });

  setTimeout(() => {
    const doc = parent.document;
    const input = doc.getElementById("ytpl-search-input") as HTMLInputElement | null;
    const resultsContainer = doc.getElementById("ytpl-search-results");
    if (!input || !resultsContainer) return;
    input.focus();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        logseq.provideUI({ key: "ytpl-search-modal", template: "" });
      }
    });

    input.addEventListener("input", () => {
      const val = input.value.trim();
      const matches = searchCachedVideos(val);
      if (matches.length === 0) {
        resultsContainer.innerHTML = `<div style="font-size: 12px; color: var(--ls-secondary-text-color, #888); padding: 8px;">No videos found.</div>`;
        return;
      }
      resultsContainer.innerHTML = matches
        .map(
          (m) => `
        <div class="ytpl-search-item" data-on-click="insertSearchResult" data-url="${escapeHtml(m.video.videoUrl)}" data-title="${escapeHtml(m.video.title)}">
          <span style="color: #ff0033;">▶</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.video.title)}</div>
            <div style="font-size: 11px; color: var(--ls-secondary-text-color, #888);">${escapeHtml(m.playlist.title)}</div>
          </div>
        </div>
      `
        )
        .join("");
    });
  }, 100);
}

function main() {
  logseq.useSettingsSchema([
    {
      key: "youtubeApiKey",
      type: "string",
      default: "",
      title: "YouTube Data API v3 Key (Optional)",
      description: API_KEY_SETTING_DESCRIPTION,
    },
  ]);

  logseq.onSettingsChanged(() => {
    void logseq.UI.showMsg(
      "Playlist settings saved. Reopen the page to refresh cards.",
      "success"
    );
  });

  logseq.provideStyle(css);
  registerRenderer();
  registerModel();

  logseq.Editor.registerSlashCommand("YouTube playlist card", async () => {
    await logseq.Editor.insertAtEditingCursor(
      "{{renderer :yt-playlist, https://www.youtube.com/playlist?list=}}"
    );
  });

  logseq.Editor.registerSlashCommand(
    "Insert playlist video",
    async () => {
      openSearchModal();
    }
  );

  logseq.Editor.registerBlockContextMenuItem(
    "Playlist → card",
    async (e: { uuid: string }) => {
      const block = await logseq.Editor.getBlock(e.uuid);
      const text = (block as { content?: string } | null)?.content ?? "";
      const m = text.match(/https?:\/\/[^\s)]+/);
      if (!m || !parsePlaylistId(m[0])) {
        await logseq.UI.showMsg("No playlist URL in this block.");
        return;
      }
      await logseq.Editor.updateBlock(
        e.uuid,
        `{{renderer :yt-playlist, ${m[0]}}}`
      );
    }
  );

  watchVideoMacros();

  console.log("[yt-playlist] loaded");
}


/**
 * Watch for blocks with `{{video URL}}` where URL contains a playlist ID.
 * Auto-convert to `{{renderer :yt-playlist, URL}}` so the card renders.
 * Single-video `{{video}}` blocks are left untouched.
 */
const recentlyConverted = new Set<string>();

async function scanAndConvert(blocks: BlockLike[] | null | undefined) {
  if (!blocks || blocks.length === 0) return;
  const toConvert = findConvertibleBlocks(blocks);
  for (const item of toConvert) {
    if (recentlyConverted.has(item.uuid)) continue;
    recentlyConverted.add(item.uuid);
    try {
      await logseq.Editor.updateBlock(item.uuid, item.newContent);
    } catch {
      // ignore update errors
    } finally {
      setTimeout(() => recentlyConverted.delete(item.uuid), 2000);
    }
  }
}

async function scanCurrentPage() {
  try {
    const blocks = await logseq.Editor.getCurrentPageBlocksTree();
    await scanAndConvert(blocks as BlockLike[]);
  } catch {
    // page may not be open yet
  }
}

function watchVideoMacros() {
  logseq.DB.onChanged(async ({ blocks }) => {
    await scanAndConvert(blocks as BlockLike[]);
  });

  logseq.App.onRouteChanged(async () => {
    setTimeout(scanCurrentPage, 500);
  });

  // Scan on startup with delays to allow page to mount
  void scanCurrentPage();
  setTimeout(scanCurrentPage, 1000);
  setTimeout(scanCurrentPage, 2500);
}

logseq.ready(main).catch(console.error);


