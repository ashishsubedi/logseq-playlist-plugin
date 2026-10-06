import { describe, expect, it } from "vitest";
// @ts-ignore - node builtin, no @types/node in this repo
import { readFileSync } from "fs";
// @ts-ignore - node builtin, no @types/node in this repo
import { join } from "path";

// @ts-ignore - __dirname exists in the vitest CJS transform
const cssPath = join(__dirname, "../src/style.css");
const css = readFileSync(cssPath, "utf8");

describe("V2 card polish inside Logseq slots", () => {
  it("scopes a box-sizing reset to the card", () => {
    expect(css).toMatch(/\.ytpl-card[^{]*\{[^}]*box-sizing:\s*border-box/);
  });

  it("sets a base line-height on the card", () => {
    expect(css).toMatch(/\.ytpl-card\s*\{[^}]*line-height/);
  });

  it("pins the thumbnail height so flex stretch cannot warp it", () => {
    expect(css).toMatch(/\.ytpl-thumb\s*\{[^}]*align-self:\s*flex-start/);
  });

  it("forces track thumbnails to fill their box", () => {
    expect(css).toMatch(
      /\.ytpl-card\s+\.ytpl-thumb\s+img\s*\{[^}]*object-fit:\s*cover/
    );
  });

  it("stacks the card on narrow Logseq slots", () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*520px\)[\s\S]*?flex-direction:\s*column/
    );
  });

  it("clusters info content at the top instead of spreading it", () => {
    expect(css).toMatch(/\.ytpl-info\s*\{[^}]*justify-content:\s*flex-start/);
  });

  it("zeroes margins on card divs so host styles cannot add gaps", () => {
    expect(css).toMatch(
      /\.ytpl-card\s+div[\s\S]*?margin:\s*0/
    );
  });

  it("neutralizes host pre-wrap so template newlines do not render as gaps", () => {
    expect(css).toMatch(/\.ytpl-card\s*\{[^}]*white-space:\s*normal/);
  });

  it("prevents vertical stretching on the card container", () => {
    expect(css).toMatch(/\.ytpl-card\s*\{[^}]*height:\s*fit-content/);
    expect(css).toMatch(/\.ytpl-card\s*\{[^}]*align-self:\s*flex-start/);
  });

  it("prevents vertical stretching on details container", () => {
    expect(css).toMatch(/\.ytpl-details\s*\{[^}]*max-height:\s*fit-content/);
  });

  it("removes margin-top: auto from actions so buttons cluster neatly below picker", () => {
    expect(css).not.toMatch(/\.ytpl-actions\s*\{[^}]*margin-top:\s*auto/);
  });

  it("restores red accent on the primary Open in YouTube button", () => {
    expect(css).toMatch(/\.ytpl-btn-primary\s*\{[^}]*rgba\(255,\s*0,\s*51/);
  });

  it("styles note banner with link accent border instead of red", () => {
    expect(css).toMatch(/\.ytpl-note\s*\{[^}]*var\(--ls-link-text-color/);
    expect(css).not.toMatch(/\.ytpl-note\s*\{[^}]*#e05656/);
  });

  it("styles track row thumbnail consistently at 64px width", () => {
    expect(css).toMatch(/\.ytpl-track-img\s*\{[^}]*width:\s*64px/);
  });
});
