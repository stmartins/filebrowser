import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, mutations } = vi.hoisted(() => ({
  store: {
    share: false,
    current: "inbox",
    permissions: {
      data: { view: true, download: true, modify: false, create: false, delete: false },
      inbox: { view: true, download: true, modify: true, create: true, delete: true },
      share: { view: true, download: true, modify: false, create: true, delete: false },
    },
  },
  mutations: { showPrompt: vi.fn() },
}));

vi.mock("@/store", () => ({
  state: {
    get req() {
      return { path: "/", source: store.current, items: [] };
    },
    get route() {
      return { path: "/other" };
    },
    get shareInfo() {
      return store.share ? { hash: "h" } : null;
    },
  },
  mutations,
  getters: {
    isShare: () => store.share,
    sourcePermissions: (source?: string) =>
      store.permissions[(source ?? store.current) as keyof typeof store.permissions],
  },
}));
vi.mock("@/utils/download", () => ({ default: vi.fn() }));
vi.mock("@/api", () => ({
  resourcesApi: {
    moveCopy: vi.fn().mockResolvedValue(undefined),
    moveCopyPublic: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/router", () => ({ router: {} }));
vi.mock("@/utils/upload.ts", () => ({ checkConflict: vi.fn(() => false) }));
vi.mock("@/utils/appNotifications.js", () => ({ notifyMoveCopyFailure: vi.fn() }));

import {
  useListingClipboard,
  __setClipboardForTest,
  __resetClipboardForTest,
} from "./useListingClipboard.ts";

describe("useListingClipboard internal paste permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.share = false;
    store.current = "inbox";
    __resetClipboardForTest();
  });

  const { handleInternalPaste } = useListingClipboard();

  it("pastes a copy out of a read-only source into a writable one", async () => {
    __setClipboardForTest({
      key: "c",
      path: "/src",
      items: [{ from: "/a.txt", fromSource: "data", name: "a.txt", isDir: false }],
    });
    await handleInternalPaste();
    expect(mutations.showPrompt).toHaveBeenCalledOnce();
  });

  it("refuses a cut out of a source that cannot modify", async () => {
    __setClipboardForTest({
      key: "x",
      path: "/src",
      items: [{ from: "/a.txt", fromSource: "data", name: "a.txt", isDir: false }],
    });
    await handleInternalPaste();
    expect(mutations.showPrompt).not.toHaveBeenCalled();
  });

  it("refuses any paste into a source that cannot create", async () => {
    store.current = "data";
    __setClipboardForTest({
      key: "c",
      path: "/src",
      items: [{ from: "/a.txt", fromSource: "inbox", name: "a.txt", isDir: false }],
    });
    await handleInternalPaste();
    expect(mutations.showPrompt).not.toHaveBeenCalled();
  });

  it("in a share, requires modify even for a copy", async () => {
    store.share = true;
    store.permissions.share.modify = false;
    store.permissions.share.create = true;
    store.current = "share";
    __setClipboardForTest({
      key: "c",
      path: "/src",
      items: [{ from: "/a.txt", fromSource: "share", name: "a.txt", isDir: false }],
    });
    await handleInternalPaste();
    expect(mutations.showPrompt).not.toHaveBeenCalled();
  });
});