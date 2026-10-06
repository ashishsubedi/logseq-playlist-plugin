import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearCacheForTests, writeCache } from "../src/playlist";

vi.mock("@logseq/libs", () => ({}));

const CS149 = "https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn";
const VIDEO = "https://www.youtube.com/watch?v=v1";

function makeLogseq() {
  return {
    ready: vi.fn().mockReturnValue({ catch: vi.fn() }),
    settings: {},
    useSettingsSchema: vi.fn(),
    onSettingsChanged: vi.fn(),
    provideStyle: vi.fn(),
    provideUI: vi.fn(),
    provideModel: vi.fn(),
    showSettingsUI: vi.fn(),
    App: { openExternalLink: vi.fn() },
    Editor: {
      insertBlock: vi.fn().mockResolvedValue({ uuid: "new" }),
      insertBatchBlock: vi.fn().mockResolvedValue([{ uuid: "n1" }]),
      appendBlockInPage: vi.fn().mockResolvedValue({ uuid: "ap" }),
      insertAtEditingCursor: vi.fn().mockResolvedValue(undefined),
      getCurrentPage: vi.fn().mockResolvedValue({ name: "journal" }),
    },
    UI: { showMsg: vi.fn().mockResolvedValue(undefined) },
  };
}

const logseqMock = makeLogseq();
vi.stubGlobal("logseq", logseqMock);
vi.stubGlobal("parent", { document: { getElementById: vi.fn() } });
vi.stubGlobal("fetch", vi.fn());

const main = await import("../src/main");

function resetAll() {
  vi.clearAllMocks();
  clearCacheForTests();
  const f = fetch as unknown as ReturnType<typeof vi.fn>;
  f.mockReset();
  (parent.document.getElementById as ReturnType<typeof vi.fn>).mockReset();
  logseqMock.Editor.insertBlock.mockResolvedValue({ uuid: "new" });
  logseqMock.Editor.insertBatchBlock.mockResolvedValue([{ uuid: "n1" }]);
  logseqMock.Editor.appendBlockInPage.mockResolvedValue({ uuid: "ap" });
  logseqMock.Editor.getCurrentPage.mockResolvedValue({ name: "journal" });
  logseqMock.App.openExternalLink.mockResolvedValue(undefined);
}

beforeEach(() => resetAll());

describe("model: addVideoRowNote", () => {
  it("inserts the note as a child of the playlist block", async () => {
    const model = main.createModel();
    await model.addVideoRowNote({
      dataset: { slotUuid: "slot-1", url: VIDEO, title: "Intro" },
    });
    expect(logseqMock.Editor.insertBlock).toHaveBeenCalledTimes(1);
    expect(logseqMock.Editor.insertBlock).toHaveBeenCalledWith(
      "slot-1",
      "### Intro\n{{video https://www.youtube.com/watch?v=v1}}\n",
      { sibling: false }
    );
    expect(logseqMock.Editor.appendBlockInPage).not.toHaveBeenCalled();
  });

  it("falls back to page append when child insert fails", async () => {
    logseqMock.Editor.insertBlock.mockRejectedValueOnce(new Error("no block"));
    const model = main.createModel();
    await model.addVideoRowNote({
      dataset: { slotUuid: "bad-slot", url: VIDEO, title: "Intro" },
    });
    expect(logseqMock.Editor.appendBlockInPage).toHaveBeenCalledWith(
      "journal",
      expect.stringContaining("### Intro")
    );
  });

  it("warns when both insert paths fail", async () => {
    logseqMock.Editor.insertBlock.mockRejectedValueOnce(new Error("x"));
    logseqMock.Editor.appendBlockInPage.mockRejectedValueOnce(new Error("y"));
    const model = main.createModel();
    await model.addVideoRowNote({
      dataset: { slotUuid: "bad-slot", url: VIDEO, title: "Intro" },
    });
    expect(logseqMock.UI.showMsg).toHaveBeenCalledWith(
      expect.stringContaining("Could not add note"),
      "warning"
    );
  });

  it("does nothing without slotUuid or url", async () => {
    const model = main.createModel();
    await model.addVideoRowNote({ dataset: {} });
    expect(logseqMock.Editor.insertBlock).not.toHaveBeenCalled();
    expect(logseqMock.Editor.appendBlockInPage).not.toHaveBeenCalled();
  });
});

describe("model: openYouTube", () => {
  it("opens https YouTube URLs externally", async () => {
    const model = main.createModel();
    await model.openYouTube({ dataset: { url: CS149 } });
    expect(logseqMock.App.openExternalLink).toHaveBeenCalledWith(CS149);
  });

  it("refuses javascript: URLs", async () => {
    const model = main.createModel();
    await model.openYouTube({ dataset: { url: "javascript:alert(1)" } });
    expect(logseqMock.App.openExternalLink).not.toHaveBeenCalled();
  });
});

describe("model: addVideoFromSelect", () => {
  it("warns when no video is selected", async () => {
    (parent.document.getElementById as ReturnType<typeof vi.fn>).mockReturnValue({
      value: "",
    });
    const model = main.createModel();
    await model.addVideoFromSelect({ dataset: { slotUuid: "slot-1" } });
    expect(logseqMock.UI.showMsg).toHaveBeenCalledWith(
      expect.stringContaining("select a video"),
      "warning"
    );
    expect(logseqMock.Editor.insertBlock).not.toHaveBeenCalled();
  });

  it("inserts the selected video as a child note", async () => {
    (parent.document.getElementById as ReturnType<typeof vi.fn>).mockReturnValue({
      value: "v1",
      selectedOptions: [
        {
          getAttribute: (k: string) =>
            k === "data-url" ? VIDEO : k === "data-title" ? "Intro" : null,
        },
      ],
    });
    const model = main.createModel();
    await model.addVideoFromSelect({ dataset: { slotUuid: "slot-1" } });
    expect(
      logseqMock.Editor.insertBlock
    ).toHaveBeenCalledWith("slot-1", expect.stringContaining(VIDEO), {
      sibling: false,
    });
  });
});

describe("model: importAllVideos", () => {
  function seedCache() {
    writeCache({
      id: "PLosJChMwPtizq2swoD8DZXc567PJ9YKnn",
      title: "CS149",
      author: "Stanford",
      thumbnailUrl: "",
      sourceUrl: CS149,
      videoCount: 2,
      items: [
        { id: "v1", title: "Intro", position: 0, thumbnailUrl: "", videoUrl: VIDEO },
        {
          id: "v2",
          title: "Arrays",
          position: 1,
          thumbnailUrl: "",
          videoUrl: "https://www.youtube.com/watch?v=v2",
        },
      ],
    });
  }

  it("batch-inserts all cached videos and confirms the count", async () => {
    seedCache();
    const model = main.createModel();
    await model.importAllVideos({
      dataset: { slotUuid: "slot-1", playlistId: "PLosJChMwPtizq2swoD8DZXc567PJ9YKnn" },
    });
    expect(logseqMock.Editor.insertBatchBlock).toHaveBeenCalledTimes(1);
    const batch = logseqMock.Editor.insertBatchBlock.mock.calls[0][1] as Array<{
      content: string;
    }>;
    expect(batch).toHaveLength(2);
    expect(batch[0].content).toContain("### Intro");
    expect(logseqMock.UI.showMsg).toHaveBeenCalledWith(
      "Imported 2 videos as notes."
    );
  });

  it("warns and inserts nothing when the cache is empty", async () => {
    const model = main.createModel();
    await model.importAllVideos({
      dataset: { slotUuid: "slot-1", playlistId: "PLmissing" },
    });
    expect(logseqMock.Editor.insertBatchBlock).not.toHaveBeenCalled();
    expect(logseqMock.Editor.insertBlock).not.toHaveBeenCalled();
    expect(logseqMock.UI.showMsg).toHaveBeenCalledWith(
      expect.stringContaining("No video list"),
      "warning"
    );
  });

  it("falls back to one-by-one insert when batch fails", async () => {
    seedCache();
    logseqMock.Editor.insertBatchBlock.mockRejectedValueOnce(new Error("batch no"));
    const model = main.createModel();
    await model.importAllVideos({
      dataset: { slotUuid: "slot-1", playlistId: "PLosJChMwPtizq2swoD8DZXc567PJ9YKnn" },
    });
    expect(logseqMock.Editor.insertBlock).toHaveBeenCalledTimes(2);
    expect(logseqMock.UI.showMsg).toHaveBeenCalledWith(
      "Imported 2 of 2 videos as notes."
    );
  });
});

describe("model: insertSearchResult", () => {
  it("inserts safe URLs at the cursor and closes the modal", async () => {
    const model = main.createModel();
    await model.insertSearchResult({ dataset: { url: VIDEO, title: "Intro" } });
    expect(logseqMock.Editor.insertAtEditingCursor).toHaveBeenCalledWith(
      expect.stringContaining(VIDEO)
    );
    expect(logseqMock.provideUI).toHaveBeenCalledWith({
      key: "ytpl-search-modal",
      template: "",
    });
  });

  it("refuses javascript: URLs", async () => {
    const model = main.createModel();
    await model.insertSearchResult({
      dataset: { url: "javascript:alert(1)", title: "x" },
    });
    expect(logseqMock.Editor.insertAtEditingCursor).not.toHaveBeenCalled();
  });
});

describe("renderCard", () => {
  function oembedOk() {
    return {
      ok: true,
      json: async () => ({
        title: "CS50x 2025",
        author_name: "CS50",
        thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg",
      }),
    };
  }

  it("provides the playlist card UI on oEmbed success", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(oembedOk());
    await main.renderCard("slot-9", "uuid-9", CS149);
    expect(logseqMock.provideUI).toHaveBeenCalledTimes(1);
    const arg = logseqMock.provideUI.mock.calls[0][0] as {
      key: string;
      template: string;
    };
    expect(arg.key).toContain("slot-9");
    expect(arg.template).toContain("CS50x 2025");
  });

  it("provides the fallback card when oEmbed fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });
    await main.renderCard("slot-9", "uuid-9", CS149);
    expect(logseqMock.provideUI).toHaveBeenCalledTimes(1);
    const arg = logseqMock.provideUI.mock.calls[0][0] as { template: string };
    expect(arg.template).toContain("Preview unavailable");
  });

  it("provides nothing for non-playlist URLs", async () => {
    await main.renderCard(
      "slot-9",
      "uuid-9",
      "https://www.youtube.com/watch?v=solo"
    );
    expect(logseqMock.provideUI).not.toHaveBeenCalled();
    expect(fetch as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});
