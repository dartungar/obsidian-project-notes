/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {TFile} from "obsidian";
import type {Menu} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {
	addNativeNoteActionsItem,
	populateNativeNoteActionsMenu,
	waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate,
} from "./project-link-menu";

ensureWindowTimersForNodeTests();

void test("does not refresh project surfaces before metadata cache settles", () => {
	const calls: string[] = [];
	const plugin = makePluginWithMetadataRefresh({
		onChanged: () => ({}),
		refreshProjectSurfaces: () => {
			calls.push("refresh");
		},
	});

	waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate(plugin, makeFile("Projects/Apollo.md", "Apollo"));

	assert.deepEqual(calls, []);
});

void test("refreshes project surfaces after the edited project metadata resolves", async () => {
	const calls: string[] = [];
	const listeners: Array<(file: TFile) => void> = [];
	const resolvedListeners: Array<() => void> = [];
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const plugin = makePluginWithMetadataRefresh({
		onChanged: (listener) => {
			listeners.push(listener);
			return {};
		},
		onResolved: (listener) => {
			resolvedListeners.push(listener);
			return {};
		},
		refreshProjectSurfaces: () => {
			calls.push("refresh");
		},
	});

	waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate(plugin, file);

	assert.deepEqual(calls, []);
	listeners[0]?.(makeFile("Projects/Zeus.md", "Zeus"));
	await nextTick();
	assert.deepEqual(calls, []);
	resolvedListeners[0]?.();
	assert.deepEqual(calls, []);

	listeners[0]?.(file);
	assert.deepEqual(calls, []);
	await nextTick();
	assert.deepEqual(calls, []);
	resolvedListeners[0]?.();
	assert.deepEqual(calls, ["refresh"]);
});

void test("refreshes project surfaces after edited project data is visible without a resolved event", async () => {
	const calls: string[] = [];
	const file = makeFile("Projects/Apollo.md", "Apollo");
	let status = "todo";
	const plugin = makePluginWithMetadataRefresh({
		onChanged: () => ({}),
		getProject: () => makeProject(file, status),
		refreshProjectSurfaces: () => {
			calls.push("refresh");
		},
	});

	waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate(plugin, file, "status", "done", {
		maxPollAttempts: 3,
		pollDelayMs: 0,
	});

	await nextTick();
	assert.deepEqual(calls, []);

	status = "done";
	await nextTick();
	assert.deepEqual(calls, ["refresh"]);
});

void test("uses window timer APIs while waiting for metadata polling", () => {
	const calls: string[] = [];
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const previousWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	const globalTimers = globalThis as unknown as {
		clearTimeout: typeof clearTimeout;
		setTimeout: typeof setTimeout;
	};
	const previousClearTimeout = globalTimers.clearTimeout;
	const previousSetTimeout = globalTimers.setTimeout;
	const timerId = 42;
	const fakeWindowTimers: Pick<Window, "clearTimeout" | "setTimeout"> = {
		clearTimeout: ((id?: number) => {
			calls.push(`window.clearTimeout:${String(id)}`);
		}) as Window["clearTimeout"],
		setTimeout: ((_handler: TimerHandler, timeout?: number) => {
			calls.push(`window.setTimeout:${String(timeout)}`);
			return timerId;
		}) as Window["setTimeout"],
	};

	try {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: fakeWindowTimers,
		});
		globalTimers.clearTimeout = (() => {
			throw new Error("Expected metadata polling to use window.clearTimeout");
		}) as unknown as typeof clearTimeout;
		globalTimers.setTimeout = (() => {
			throw new Error("Expected metadata polling to use window.setTimeout");
		}) as unknown as typeof setTimeout;

		const plugin = makePluginWithMetadataRefresh({
			onChanged: () => ({}),
			refreshProjectSurfaces: () => {
				calls.push("refresh");
			},
		});
		const cancel = waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate(plugin, file, "status", "done", {
			maxPollAttempts: 3,
			pollDelayMs: 75,
		});

		assert.deepEqual(calls, ["window.setTimeout:75"]);
		cancel();
		assert.deepEqual(calls, ["window.setTimeout:75", "window.clearTimeout:42"]);
	} finally {
		globalTimers.clearTimeout = previousClearTimeout;
		globalTimers.setTimeout = previousSetTimeout;
		if (previousWindowDescriptor) {
			Object.defineProperty(globalThis, "window", previousWindowDescriptor);
		} else {
			delete (globalThis as Record<string, unknown>).window;
		}
	}
});

void test("adds note actions as an active root submenu trigger without populating native actions", () => {
	let handleLinkContextMenuCalls = 0;
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const rootMenu = makeRecordingMenu();
	const plugin = makePlugin({
		handleLinkContextMenu: () => {
			handleLinkContextMenuCalls += 1;
			return true;
		},
	});

	addNativeNoteActionsItem(rootMenu as unknown as Menu, plugin, file, "Daily.md", {
		createTitle: () => "Note actions ›",
	});

	assert.equal(handleLinkContextMenuCalls, 0);
	assert.equal(rootMenu.separators, 1);
	assert.equal(rootMenu.items.length, 1);
	assert.equal(rootMenu.items[0]?.title, "Note actions ›");
	assert.equal(rootMenu.items[0]?.isLabel, false);
	assert.equal(typeof rootMenu.items[0]?.click, "function");
});

void test("populates native note actions into the provided note actions menu", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const noteActionsMenu = makeRecordingMenu();
	const handledMenus: Menu[] = [];
	const plugin = makePlugin({
		handleLinkContextMenu: (menu, linktext, sourcePath) => {
			handledMenus.push(menu);
			assert.equal(linktext, "Projects/Apollo.md");
			assert.equal(sourcePath, "Daily.md");
			return true;
		},
	});

	const handled = populateNativeNoteActionsMenu(noteActionsMenu as unknown as Menu, plugin, file, "Daily.md");

	assert.equal(handled, true);
	assert.deepEqual(handledMenus, [noteActionsMenu]);
});

function makePlugin(workspace: {
	handleLinkContextMenu: (menu: Menu, linktext: string, sourcePath: string) => boolean;
}): SimpleProjectViewsPlugin {
	return {
		app: {
			workspace: {
				getMostRecentLeaf: () => null,
				handleLinkContextMenu: workspace.handleLinkContextMenu,
			},
		},
	} as unknown as SimpleProjectViewsPlugin;
}

function makePluginWithMetadataRefresh(options: {
	getProject?: () => ProjectInfo | null;
	onChanged: (listener: (file: TFile) => void) => object;
	onResolved?: (listener: () => void) => object;
	refreshProjectSurfaces: () => void;
}): SimpleProjectViewsPlugin {
	return {
		app: {
			metadataCache: {
				on: (name: string, callback: unknown) => {
					if (name === "resolved") {
						return options.onResolved?.(callback as () => void) ?? {};
					}

					return options.onChanged(callback as (file: TFile) => void);
				},
				offref: () => {
				},
			},
		},
		registerEvent: () => {
		},
		settings: {
			propertyNames: {
				status: "status",
			},
		},
		projectIndex: {
			getProject: options.getProject ?? (() => null),
		},
		refreshProjectSurfaces: options.refreshProjectSurfaces,
	} as unknown as SimpleProjectViewsPlugin;
}

function makeFile(path: string, basename: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = basename;
	return file;
}

function makeProject(file: TFile, status: string): ProjectInfo {
	return {
		file,
		title: file.basename,
		icon: "",
		status,
		properties: [],
		relationships: {parent: null, children: []},
	};
}

function nextTick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function ensureWindowTimersForNodeTests(): void {
	if (Object.getOwnPropertyDescriptor(globalThis, "window")) {
		return;
	}

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			clearTimeout: globalThis.clearTimeout,
			setTimeout: globalThis.setTimeout,
		},
	});
}

interface RecordedMenuItem {
	title: string | DocumentFragment;
	icon: string | null;
	isLabel: boolean;
	click: ((event: MouseEvent | KeyboardEvent) => void) | null;
}

function makeRecordingMenu(): {
	items: RecordedMenuItem[];
	separators: number;
	addItem: (callback: (item: RecordingMenuItem) => void) => unknown;
	addSeparator: () => unknown;
} {
	return {
		items: [],
		separators: 0,
		addItem(callback: (item: RecordingMenuItem) => void): unknown {
			const item = new RecordingMenuItem();
			callback(item);
			this.items.push(item.record);
			return this;
		},
		addSeparator(): unknown {
			this.separators += 1;
			return this;
		},
	};
}

class RecordingMenuItem {
	record: RecordedMenuItem = {
		title: "",
		icon: null,
		isLabel: false,
		click: null,
	};

	setTitle(title: string | DocumentFragment): this {
		this.record.title = title;
		return this;
	}

	setIcon(icon: string | null): this {
		this.record.icon = icon;
		return this;
	}

	setIsLabel(isLabel: boolean): this {
		this.record.isLabel = isLabel;
		return this;
	}

	onClick(callback: (event: MouseEvent | KeyboardEvent) => void): this {
		this.record.click = callback;
		return this;
	}
}
