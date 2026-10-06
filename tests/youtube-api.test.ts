import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildYouTubeApiPlaylistUrl,
  buildYouTubeApiItemsUrl,
  parseYouTubePlaylistResponse,
  parseYouTubePlaylistItemsResponse,
  fetchYouTubeApiMeta,
  clearCacheForTests,
  readCache,
  API_KEY_SETTING_DESCRIPTION,
} from "../src/playlist";

beforeEach(() => clearCacheForTests());

describe("YouTube Data API URL builders", () => {
  it("builds correct playlists endpoint URL", () => {
    const url = buildYouTubeApiPlaylistUrl("PL123", "AIzaSyTest");
    expect(url).toBe(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&id=PL123&key=AIzaSyTest"
    );
  });

  it("builds correct playlistItems endpoint URL", () => {
    const url = buildYouTubeApiItemsUrl("PL123", "AIzaSyTest");
    expect(url).toBe(
      "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet%2CcontentDetails&playlistId=PL123&maxResults=50&key=AIzaSyTest"
    );
  });
});

describe("YouTube Data API response parsers", () => {
  it("parses playlist response correctly", () => {
    const sample = {
      items: [
        {
          snippet: {
            title: "Stanford CS149",
            channelTitle: "kein406",
            thumbnails: {
              high: { url: "https://i.ytimg.com/vi/abc/hqdefault.jpg" },
            },
          },
          contentDetails: {
            itemCount: 28,
          },
        },
      ],
    };
    const parsed = parseYouTubePlaylistResponse(sample);
    expect(parsed).toEqual({
      title: "Stanford CS149",
      author: "kein406",
      thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
      videoCount: 28,
    });
  });

  it("returns null if playlist response items is empty", () => {
    expect(parseYouTubePlaylistResponse({ items: [] })).toBeNull();
  });

  it("parses playlist items response correctly", () => {
    const sample = {
      items: [
        {
          snippet: {
            title: "Course Intro",
            position: 0,
            resourceId: { videoId: "vid1" },
            thumbnails: {
              medium: { url: "https://i.ytimg.com/vi/vid1/mqdefault.jpg" },
            },
          },
        },
        {
          snippet: {
            title: "Work & Span",
            position: 1,
            resourceId: { videoId: "vid2" },
            thumbnails: {
              default: { url: "https://i.ytimg.com/vi/vid2/default.jpg" },
            },
          },
        },
      ],
    };
    const parsed = parseYouTubePlaylistItemsResponse(sample);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      id: "vid1",
      title: "Course Intro",
      position: 0,
      thumbnailUrl: "https://i.ytimg.com/vi/vid1/mqdefault.jpg",
      videoUrl: "https://www.youtube.com/watch?v=vid1",
    });
    expect(parsed[1]?.id).toBe("vid2");
  });
});

describe("fetchYouTubeApiMeta", () => {
  it("fetches enriched metadata with total count and video items", async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/playlists?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: {
                  title: "CS149 Parallel Computing",
                  channelTitle: "Stanford",
                  thumbnails: {
                    high: { url: "https://i.ytimg.com/thumb.jpg" },
                  },
                },
                contentDetails: { itemCount: 28 },
              },
            ],
          }),
        };
      }
      if (url.includes("/playlistItems?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: {
                  title: "Lecture 1",
                  position: 0,
                  resourceId: { videoId: "v1" },
                  thumbnails: {
                    default: { url: "https://i.ytimg.com/v1.jpg" },
                  },
                },
              },
            ],
          }),
        };
      }
      return { ok: false };
    });

    const res = await fetchYouTubeApiMeta(
      "https://www.youtube.com/playlist?list=PL123",
      "test-key",
      fetcher as unknown as typeof fetch
    );

    expect(res).not.toBeNull();
    expect(res?.title).toBe("CS149 Parallel Computing");
    expect(res?.author).toBe("Stanford");
    expect(res?.videoCount).toBe(28);
    expect(res?.items).toHaveLength(1);
    expect(res?.items?.[0]?.title).toBe("Lecture 1");
    // cached
    const cached = readCache("PL123");
    expect(cached?.videoCount).toBe(28);
  });

  it("returns null on API failure (e.g. quota exceeded)", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });
    const res = await fetchYouTubeApiMeta(
      "https://www.youtube.com/playlist?list=PL123",
      "bad-key",
      fetcher as unknown as typeof fetch
    );
    expect(res).toBeNull();
  });
});

describe("API_KEY_SETTING_DESCRIPTION", () => {
  it("provides clear step-by-step instructions for creating and configuring an API key", () => {
    expect(API_KEY_SETTING_DESCRIPTION).toContain("console.cloud.google.com");
    expect(API_KEY_SETTING_DESCRIPTION).toContain("YouTube Data API v3");
    expect(API_KEY_SETTING_DESCRIPTION).toContain("Application restrictions");
    expect(API_KEY_SETTING_DESCRIPTION).toContain("None");
    expect(API_KEY_SETTING_DESCRIPTION).toContain("API restrictions");
    expect(API_KEY_SETTING_DESCRIPTION).toContain("5 minutes");
  });

  it("follows short sentence guidelines (under 20 words per line/instruction)", () => {
    const lines = API_KEY_SETTING_DESCRIPTION.split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("http"));
    for (const line of lines) {
      const words = line.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(20);
    }
  });
});
