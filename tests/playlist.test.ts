import { describe, expect, it } from "vitest";
import {
  buildEmbedUrl,
  buildOEmbedUrl,
  escapeHtml,
  parsePlaylistId,
} from "../src/playlist";

describe("parsePlaylistId", () => {
  it("parses playlist?list= URL", () => {
    expect(
      parsePlaylistId(
        "https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn"
      )
    ).toBe("PLosJChMwPtizq2swoD8DZXc567PJ9YKnn");
  });

  it("parses watch?v=x&list=y URL", () => {
    expect(
      parsePlaylistId("https://www.youtube.com/watch?v=abc123&list=PLxyz456")
    ).toBe("PLxyz456");
  });

  it("parses youtu.be with list param", () => {
    expect(parsePlaylistId("https://youtu.be/abc123?list=PLxyz789")).toBe(
      "PLxyz789"
    );
  });

  it("parses music.youtube.com URL", () => {
    expect(
      parsePlaylistId("https://music.youtube.com/playlist?list=PLmusic001")
    ).toBe("PLmusic001");
  });

  it("returns null for single video without list", () => {
    expect(parsePlaylistId("https://www.youtube.com/watch?v=abc123")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(parsePlaylistId("not-a-url")).toBeNull();
  });
});

describe("buildOEmbedUrl", () => {
  it("builds oEmbed URL for playlist", () => {
    const url =
      "https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn";
    expect(buildOEmbedUrl(url)).toBe(
      "https://www.youtube.com/oembed?url=" +
        encodeURIComponent(url) +
        "&format=json"
    );
  });
});

describe("buildEmbedUrl", () => {
  it("builds videoseries embed URL", () => {
    expect(buildEmbedUrl("PLabc123")).toBe(
      "https://www.youtube.com/embed/videoseries?list=PLabc123"
    );
  });
});

describe("escapeHtml", () => {
  it("escapes HTML chars", () => {
    expect(escapeHtml('<a href="x">&')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;"
    );
  });
});
