import { describe, expect, it } from "vitest";
import {
  cardTemplate,
  convertVideoToRenderer,
  fallbackTemplate,
  findConvertibleBlocks,
  selectPlaylistUrl,
  type BlockLike,
  type PlaylistMeta,
} from "../src/playlist";

const CS149 = "https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn";
const WATCH_LIST = "https://www.youtube.com/watch?v=abc123&list=PLxyz456";
const SINGLE = "https://www.youtube.com/watch?v=abc123";

describe("selectPlaylistUrl", () => {
  it("picks URL from :yt-playlist args", () => {
    expect(selectPlaylistUrl([":yt-playlist", CS149])).toBe(CS149);
  });

  it("picks URL from {{video URL}} style args", () => {
    expect(selectPlaylistUrl([WATCH_LIST])).toBe(WATCH_LIST);
  });

  it("ignores single video without list param", () => {
    expect(selectPlaylistUrl([SINGLE])).toBeNull();
  });

  it("ignores non-URL args", () => {
    expect(selectPlaylistUrl([":yt-playlist", "not-a-url"])).toBeNull();
  });

  it("returns null for empty args", () => {
    expect(selectPlaylistUrl([])).toBeNull();
  });

  it("accepts quoted playlist URL", () => {
    expect(
      selectPlaylistUrl([
        ":yt-playlist",
        '"https://www.youtube.com/playlist?list=PLquoted1"',
      ])
    ).toBe("https://www.youtube.com/playlist?list=PLquoted1");
  });
});

describe("V1 no-embed rule", () => {
  const meta: PlaylistMeta = {
    id: "PLabc",
    title: "T",
    author: "A",
    thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
    sourceUrl: CS149,
  };

  it("collapsed card has no iframe", () => {
    expect(cardTemplate(meta, "u1", false)).not.toMatch(/<iframe/i);
  });

  it("expanded card has no iframe", () => {
    expect(cardTemplate(meta, "u1", true)).not.toMatch(/<iframe/i);
  });

  it("fallback card has no iframe", () => {
    expect(fallbackTemplate(CS149)).not.toMatch(/<iframe/i);
  });

  it("expand control lives inside the card", () => {
    const html = cardTemplate(meta, "u1", false);
    expect(html.indexOf("ytpl-details")).toBeGreaterThan(
      html.indexOf("ytpl-card")
    );
    expect(html.trim().endsWith("</div>")).toBe(true);
  });
});

describe("convertVideoToRenderer", () => {
  it("converts {{video URL}} with playlist to renderer", () => {
    const input =
      "{{video https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn}}";
    expect(convertVideoToRenderer(input)).toBe(
      "{{renderer :yt-playlist, https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn}}"
    );
  });

  it("converts watch+list URL inside {{video}}", () => {
    const input =
      "{{video https://www.youtube.com/watch?v=abc123&list=PLxyz456}}";
    expect(convertVideoToRenderer(input)).toBe(
      "{{renderer :yt-playlist, https://www.youtube.com/watch?v=abc123&list=PLxyz456}}"
    );
  });

  it("returns null for single video without list", () => {
    const input = "{{video https://www.youtube.com/watch?v=abc123}}";
    expect(convertVideoToRenderer(input)).toBeNull();
  });

  it("returns null when no {{video}} macro present", () => {
    expect(convertVideoToRenderer("just some text")).toBeNull();
  });

  it("preserves surrounding block content", () => {
    const input =
      "Some text\n{{video https://www.youtube.com/playlist?list=PLabc}}\nMore text";
    const result = convertVideoToRenderer(input);
    expect(result).toBe(
      "Some text\n{{renderer :yt-playlist, https://www.youtube.com/playlist?list=PLabc}}\nMore text"
    );
  });

  it("does not convert {{renderer :yt-playlist}} that already exists", () => {
    const input =
      "{{renderer :yt-playlist, https://www.youtube.com/playlist?list=PLabc}}";
    expect(convertVideoToRenderer(input)).toBeNull();
  });

  it("converts every playlist {{video}} macro in one block", () => {
    const input =
      "{{video https://www.youtube.com/playlist?list=PLone}} and {{video https://www.youtube.com/watch?v=vid&list=PLtwo}}";
    expect(convertVideoToRenderer(input)).toBe(
      "{{renderer :yt-playlist, https://www.youtube.com/playlist?list=PLone}} and {{renderer :yt-playlist, https://www.youtube.com/watch?v=vid&list=PLtwo}}"
    );
  });

  it("leaves single-video macros alone while converting playlist ones", () => {
    const input =
      "{{video https://www.youtube.com/watch?v=solo}} plus {{video https://www.youtube.com/playlist?list=PLkeep}}";
    expect(convertVideoToRenderer(input)).toBe(
      "{{video https://www.youtube.com/watch?v=solo}} plus {{renderer :yt-playlist, https://www.youtube.com/playlist?list=PLkeep}}"
    );
  });
});

describe("findConvertibleBlocks", () => {
  it("finds blocks containing playlist {{video}} macros", () => {
    const tree: BlockLike[] = [
      {
        uuid: "b1",
        content:
          "{{video https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn}}",
      },
      {
        uuid: "b2",
        content: "{{video https://www.youtube.com/watch?v=single123}}",
      },
      {
        uuid: "b3",
        title: "Heading",
        children: [
          {
            uuid: "b4",
            content:
              "{{video https://www.youtube.com/watch?v=vid&list=PLnested}}",
          },
        ],
      },
    ];

    const result = findConvertibleBlocks(tree);
    expect(result).toEqual([
      {
        uuid: "b1",
        newContent:
          "{{renderer :yt-playlist, https://www.youtube.com/playlist?list=PLosJChMwPtizq2swoD8DZXc567PJ9YKnn}}",
      },
      {
        uuid: "b4",
        newContent:
          "{{renderer :yt-playlist, https://www.youtube.com/watch?v=vid&list=PLnested}}",
      },
    ]);
  });

  it("returns empty array for empty tree or no matches", () => {
    expect(findConvertibleBlocks([])).toEqual([]);
    expect(
      findConvertibleBlocks([{ uuid: "x", content: "regular text" }])
    ).toEqual([]);
  });
});

