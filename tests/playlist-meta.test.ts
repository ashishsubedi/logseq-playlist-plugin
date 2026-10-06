import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  cardTemplate,
  clearCacheForTests,
  fallbackTemplate,
  fetchPlaylistMeta,
  noteBlockContent,
  type PlaylistMeta,
} from "../src/playlist";

const meta: PlaylistMeta = {
  id: "PLabc",
  title: "CS149 <Test>",
  author: "Stanford",
  thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
  sourceUrl: "https://www.youtube.com/playlist?list=PLabc",
};

beforeEach(() => clearCacheForTests());

describe("fetchPlaylistMeta", () => {
  it("returns meta from oEmbed and caches it", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "CS149",
        author_name: "Stanford",
        thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg",
      }),
    });
    const m = await fetchPlaylistMeta(
      "https://www.youtube.com/playlist?list=PLabc",
      fetcher as unknown as typeof fetch
    );
    expect(m?.title).toBe("CS149");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const m2 = await fetchPlaylistMeta(
      "https://www.youtube.com/playlist?list=PLabc",
      fetcher as unknown as typeof fetch
    );
    expect(m2?.title).toBe("CS149");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns null on oEmbed 404", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const m = await fetchPlaylistMeta(
      "https://www.youtube.com/playlist?list=PLbad",
      fetcher as unknown as typeof fetch
    );
    expect(m).toBeNull();
  });

  it("returns null for non-playlist URL", async () => {
    const fetcher = vi.fn();
    const m = await fetchPlaylistMeta(
      "https://www.youtube.com/watch?v=abc",
      fetcher as unknown as typeof fetch
    );
    expect(m).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("noteBlockContent", () => {
  it("builds block with title and video macro", () => {
    expect(noteBlockContent("Intro", "https://youtu.be/x")).toBe(
      "### Intro\n{{video https://youtu.be/x}}\n"
    );
  });
});

describe("templates", () => {
  it("card escapes HTML and shows actions", () => {
    const html = cardTemplate(meta, "uuid-1", false);
    expect(html).toContain("CS149 &lt;Test&gt;");
    expect(html).toContain("Expand");
    expect(html).not.toContain("Expand inline");
    expect(html).not.toContain("Import as blocks");
    expect(html).toContain("Open in YouTube");
    expect(html).not.toContain("<Test>");
  });

  it("expanded card shows track row without note block button", () => {
    const html = cardTemplate(meta, "uuid-1", true);
    expect(html).toContain("ytpl-track");
    expect(html).toContain("CS149 &lt;Test&gt;");
    expect(html).not.toContain("+ note block");
  });

  it("fallback shows Open button", () => {
    expect(fallbackTemplate("https://www.youtube.com/playlist?list=PLx")).toContain(
      "Open in YouTube"
    );
  });
});
