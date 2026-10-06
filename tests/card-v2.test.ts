import { describe, expect, it } from "vitest";
import { cardTemplate, type PlaylistMeta } from "../src/playlist";

const metaWithItems: PlaylistMeta = {
  id: "PL123",
  title: "CS149 Parallel Computing",
  author: "kein406",
  thumbnailUrl: "https://i.ytimg.com/vi/thumb/hqdefault.jpg",
  sourceUrl: "https://www.youtube.com/playlist?list=PL123",
  videoCount: 28,
  items: [
    {
      id: "v1",
      title: "1. Course Intro",
      position: 0,
      thumbnailUrl: "https://i.ytimg.com/vi/v1/mqdefault.jpg",
      videoUrl: "https://www.youtube.com/watch?v=v1",
    },
    {
      id: "v2",
      title: "2. Work & Span",
      position: 1,
      thumbnailUrl: "https://i.ytimg.com/vi/v2/mqdefault.jpg",
      videoUrl: "https://www.youtube.com/watch?v=v2",
    },
  ],
};

const metaWithoutItems: PlaylistMeta = {
  id: "PL456",
  title: "Simple Playlist",
  author: "Author",
  thumbnailUrl: "https://i.ytimg.com/vi/thumb/hqdefault.jpg",
  sourceUrl: "https://www.youtube.com/playlist?list=PL456",
};

describe("V2 cardTemplate", () => {
  it("renders count badge when videoCount is provided", () => {
    const html = cardTemplate(metaWithItems, "slot-1", false);
    expect(html).toContain("28");
    expect(html).toContain("VIDEOS");
  });

  it("renders quick video picker when items are present", () => {
    const html = cardTemplate(metaWithItems, "slot-1", false);
    expect(html).toContain("ytpl-quick-picker");
    expect(html).toContain("ytpl-select");
    expect(html).toContain("1. Course Intro");
    expect(html).toContain("2. Work &amp; Span");
    expect(html).toContain("+ Add Note");
    expect(html).toContain("data-on-click=\"addVideoFromSelect\"");
  });

  it("renders Import All button when items are present", () => {
    const html = cardTemplate(metaWithItems, "slot-1", false);
    expect(html).toContain("Import All (28)");
    expect(html).toContain("data-on-click=\"importAllVideos\"");
  });

  it("renders tracklist rows in details when items are present", () => {
    const html = cardTemplate(metaWithItems, "slot-1", false);
    expect(html).toContain("ytpl-tracklist");
    expect(html).toContain("ytpl-track-row");
    expect(html).toContain("#1");
    expect(html).toContain("#2");
    expect(html).toContain("data-on-click=\"addVideoRowNote\"");
    expect(html).toContain("View All 28 Videos");
  });

  it("falls back to V1 card template when items are not present", () => {
    const html = cardTemplate(metaWithoutItems, "slot-2", false);
    expect(html).not.toContain("ytpl-quick-picker");
    expect(html).not.toContain("Import All");
    expect(html).toContain("V1 shows one entry");
  });

  it("offers a Settings shortcut on the default card so users can add a key", () => {
    const html = cardTemplate(metaWithoutItems, "slot-2", false);
    expect(html).toContain('data-on-click="openSettings"');
  });

  it("renders Settings button to configure API key", () => {
    const html = cardTemplate(metaWithoutItems, "slot-2", false);
    expect(html).toContain("data-on-click=\"openSettings\"");
    expect(html).toContain("Settings");
  });

  it("never includes iframe tag", () => {
    const html = cardTemplate(metaWithItems, "slot-1", true);
    expect(html.toLowerCase()).not.toContain("<iframe");
  });
});
