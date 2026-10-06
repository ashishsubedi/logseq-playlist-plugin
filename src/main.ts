import "@logseq/libs";
import css from "./style.css?raw";
import {
  cardTemplate,
  fallbackTemplate,
  fetchPlaylistMeta,
  findConvertibleBlocks,
  noteBlockContent,
  parsePlaylistId,
  selectPlaylistUrl,
  type BlockLike,
} from "./playlist";

function rendererArgs(payload: { arguments?: string[] }): string[] {
  return payload.arguments ?? [];
}

async function renderCard(slot: string, blockUuid: string, url: string) {
  const id = parsePlaylistId(url);
  if (!id) return;
  const meta = await fetchPlaylistMeta(url);
  const key = `ytpl-${id}-${slot}`;
  const template = meta
    ? cardTemplate(meta, blockUuid, false)
    : fallbackTemplate(url);
  logseq.provideUI({ key, slot, reset: true, template });
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
      const url = e.dataset.url;
      if (!url) return;
      try {
        await logseq.App.openExternalLink(url);
      } catch {
        window.open(url, "_blank");
      }
    },
    async addNoteBlock(e: {
      dataset: { slotUuid?: string; url?: string; title?: string };
    }) {
      const { slotUuid, url, title } = e.dataset;
      if (!slotUuid || !url) return;
      await addNote(slotUuid, url, title ?? "Playlist note");
    },
    async importAll(e: {
      dataset: { slotUuid?: string; url?: string; title?: string };
    }) {
      const { slotUuid, url, title } = e.dataset;
      if (!slotUuid || !url) return;
      await addNote(slotUuid, url, title ?? "Playlist");
    },
  });
}

function main() {
  logseq.provideStyle(css);
  registerRenderer();
  registerModel();

  logseq.Editor.registerSlashCommand("YouTube playlist card", async () => {
    await logseq.Editor.insertAtEditingCursor(
      "{{renderer :yt-playlist, https://www.youtube.com/playlist?list=}}"
    );
  });

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

  // Expand uses native <details> element. No JS toggle is needed.

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


