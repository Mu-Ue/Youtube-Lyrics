import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {})),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      }),
    },
  },
});

import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../../src/content/storage";

describe("panel settings", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("returns the defaults when nothing is stored", async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings", async () => {
    await saveSettings({ open: true, insideDescription: true });
    expect(await loadSettings()).toEqual({ open: true, insideDescription: true });
  });

  it("falls back to defaults for malformed data", async () => {
    store["panelSettings"] = "garbage";
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("ignores values of the wrong type", async () => {
    store["panelSettings"] = { open: "yes", insideDescription: 1 };
    expect(await loadSettings()).toEqual({ open: false, insideDescription: false });
  });
});
