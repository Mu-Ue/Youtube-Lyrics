import { describe, expect, it } from "vitest";

import { filterTitle, getVideoTitle } from "../../src/content/title";

describe("filterTitle", () => {
  it.each([
    ["Bohemian Rhapsody", "bohemian rhapsody"],
    ["Artist - Song Name [Official Audio]", "artist song name"],
    ["Artist ft. Guest – Title (Lyrics)", "artist title"],
    ["Artist — Song (HD Official Music Video)", "artist song"],
    ["Artist - Song Official Video", "artist song"],
    ["Chris & Alianah", "chris alianah"],
    ["Rock | Roll", "rock roll"],
    ["Song [Remix]", "song"],
    ["Song ft. Artist", "song"],
    ["Artist feat. Guest Name - Song", "artist song"],
    ["Artist - Song featuring A & B", "artist song"],
    ["Left Outside Alone", "left outside alone"],
    ["[Intro] Song & Hook (Live) ft. Artist", "song hook"],
    ['Artist - "Quoted" Title', "artist quoted title"],
    ["Live Forever", "live forever"],
    ["Radio Ga Ga", "radio ga ga"],
    ["(3) Artist - Song", "artist song"],
  ])("cleans %j into %j", (input, expected) => {
    expect(filterTitle(input)).toBe(expected);
  });

  it("returns an empty string when nothing but brackets remains", () => {
    expect(filterTitle("[Remix]")).toBe("");
  });

  it("handles nested brackets", () => {
    expect(filterTitle("Song (Live [Remastered])")).toBe("song");
  });
});

describe("getVideoTitle", () => {
  it("strips the YouTube suffix", () => {
    expect(getVideoTitle("Artist - Song - YouTube")).toBe("Artist - Song");
  });

  it("leaves other titles untouched", () => {
    expect(getVideoTitle("YouTube")).toBe("YouTube");
  });
});
