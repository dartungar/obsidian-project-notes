/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {TFile} from "obsidian";
import type {Menu} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {
	addNativeNoteActionsItem,
	populateNativeNoteActionsMenu,
	waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate,
} from "./project-link-menu";

void test("does not refresh project surfaces before metadata cache settles", () => {
	const calls: string[] = [];
	const plugin = {
		refreshProjectSurfaces: () => {
			calls.push("refresh");
		},
	} as unknown as SimpleProjectViewsPlugin;

	waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate(plugin);

	assert.deepEqual(calls, []);
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

function makeFile(path: string, basename: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = basename;
	return file;
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
