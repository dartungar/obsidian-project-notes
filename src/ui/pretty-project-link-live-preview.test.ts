/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {Prec} from "@codemirror/state";
import type {EditorView, ViewUpdate} from "@codemirror/view";
import {editorInfoField, editorLivePreviewField, TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {normalizeSettings} from "../settings";
import {
	buildPrettyProjectLinkDecorations,
	createPrettyProjectLinkLivePreviewExtension,
	hasPrettyProjectLinkRefreshEffect,
	refreshPrettyProjectLinkLivePreviewEditors,
	shouldIgnorePrettyProjectLinkWidgetEvent,
	shouldPreservePreviousPrettyProjectLinkDecorations,
	shouldRenderPrettyProjectLinkRange,
	trackPrettyProjectLinkLivePreviewView,
	untrackPrettyProjectLinkLivePreviewView,
} from "./pretty-project-link-live-preview";

void test("registers pretty link Live Preview decorations at highest precedence", () => {
	const extension = createPrettyProjectLinkLivePreviewExtension(makePlugin(null, null)) as {prec?: number; inner?: unknown};
	const highestExtension = Prec.highest([]);

	assert.equal(extension.prec, (highestExtension as {prec?: number}).prec);
	assert.ok(extension.inner);
});

void test("dispatches refresh effects to tracked Live Preview editors", () => {
	const dispatchedEffects: unknown[] = [];
	const view = {
		state: {
			selection: {ranges: [{from: 0, to: 0}]},
		},
		dispatch: (spec: {effects: unknown}) => {
			dispatchedEffects.push(spec.effects);
		},
	} as unknown as EditorView;

	trackPrettyProjectLinkLivePreviewView(view);
	try {
		refreshPrettyProjectLinkLivePreviewEditors();
	} finally {
		untrackPrettyProjectLinkLivePreviewView(view);
	}

	assert.equal(dispatchedEffects.length, 1);
	assert.equal(hasPrettyProjectLinkRefreshEffect({
		transactions: [{effects: dispatchedEffects}],
	} as unknown as ViewUpdate), true);
});

void test("refresh dispatch explicitly sets the current selection", () => {
	const selection = {ranges: [{from: 5, to: 5}]};
	const dispatches: Array<{selection?: unknown}> = [];
	const view = {
		state: {selection},
		dispatch: (spec: {selection?: unknown}) => {
			dispatches.push(spec);
		},
	} as unknown as EditorView;

	trackPrettyProjectLinkLivePreviewView(view);
	try {
		refreshPrettyProjectLinkLivePreviewEditors();
	} finally {
		untrackPrettyProjectLinkLivePreviewView(view);
	}

	assert.equal(dispatches[0]?.selection, selection);
});

void test("does not report a refresh effect for unrelated editor updates", () => {
	assert.equal(hasPrettyProjectLinkRefreshEffect({
		transactions: [{effects: []}],
	} as unknown as ViewUpdate), false);
});

void test("keeps selected pretty links rendered during explicit refresh", () => {
	const view = makeSelectionView(10, 20);

	assert.equal(shouldRenderPrettyProjectLinkRange(view, 10, 20, false), false);
	assert.equal(shouldRenderPrettyProjectLinkRange(view, 10, 20, true), true);
});

void test("reveals the markdown link when only the cursor is inside the link", () => {
	const view = makeSelectionView(15, 15);

	assert.equal(shouldRenderPrettyProjectLinkRange(view, 10, 20, false), false);
});

void test("renders a pretty link when the cursor is adjacent to the link", () => {
	const beforeView = makeSelectionView(10, 10);
	const afterView = makeSelectionView(20, 20);

	assert.equal(shouldRenderPrettyProjectLinkRange(beforeView, 10, 20, false), true);
	assert.equal(shouldRenderPrettyProjectLinkRange(afterView, 10, 20, false), true);
});

void test("keeps pretty link widget events from moving the editor selection", () => {
	assert.equal(shouldIgnorePrettyProjectLinkWidgetEvent({type: "contextmenu"} as Event), true);
	assert.equal(shouldIgnorePrettyProjectLinkWidgetEvent({type: "mousedown"} as Event), true);
	assert.equal(shouldIgnorePrettyProjectLinkWidgetEvent({type: "keydown"} as Event), true);
});

void test("keeps existing pretty links during explicit refresh when metadata is temporarily stale", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const view = makeLivePreviewView("[[Projects/Apollo]]", "Daily.md");
	const initialDecorations = buildPrettyProjectLinkDecorations(makePlugin(file, project), view);
	const refreshedDecorations = buildPrettyProjectLinkDecorations(makePlugin(file, null), view, {
		preservePreviousOnMissingProject: true,
		previousDecorations: initialDecorations,
	});

	assert.equal(initialDecorations.size, 1);
	assert.equal(refreshedDecorations.size, 1);
	assert.equal(getOnlyDecoration(refreshedDecorations), getOnlyDecoration(initialDecorations));
});

void test("finds pretty links inside collapsed visible ranges by scanning the viewport", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const view = makeLivePreviewView("[[Projects/Apollo]]", "Daily.md", {
		visibleRanges: [{from: 0, to: 0}],
	});
	const decorations = buildPrettyProjectLinkDecorations(makePlugin(file, project), view);

	assert.equal(decorations.size, 1);
});

void test("preserves previous pretty links for non-document updates only", () => {
	assert.equal(shouldPreservePreviousPrettyProjectLinkDecorations({docChanged: false} as ViewUpdate), true);
	assert.equal(shouldPreservePreviousPrettyProjectLinkDecorations({docChanged: true} as ViewUpdate), false);
});

function makeSelectionView(from: number, to: number): EditorView {
	return {
		state: {
			selection: {
				ranges: [{from, to}],
			},
		},
	} as unknown as EditorView;
}

function makeLivePreviewView(
	content: string,
	sourcePath: string,
	options: {visibleRanges?: Array<{from: number; to: number}>} = {},
): EditorView {
	return {
		viewport: {from: 0, to: content.length},
		visibleRanges: options.visibleRanges ?? [{from: 0, to: content.length}],
		state: {
			doc: {
				sliceString: (from: number, to: number) => content.slice(from, to),
			},
			selection: {
				ranges: [{from: 0, to: 0}],
			},
			field: (field: unknown) => {
				if (field === editorLivePreviewField) {
					return true;
				}

				if (field === editorInfoField) {
					return {file: {path: sourcePath}};
				}

				return undefined;
			},
		},
	} as unknown as EditorView;
}

function makePlugin(resolvedFile: TFile | null, project: ProjectInfo | null): SimpleProjectViewsPlugin {
	return {
		settings: normalizeSettings(),
		app: {
			metadataCache: {
				getFirstLinkpathDest: () => resolvedFile,
			},
		},
		projectIndex: {
			getProject: () => project,
		},
	} as unknown as SimpleProjectViewsPlugin;
}

function makeFile(path: string, basename: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = basename;
	return file;
}

function makeProject(file: TFile): ProjectInfo {
	return {
		file,
		title: file.basename,
		icon: "",
		status: "todo",
		properties: [],
		relationships: {parent: null, children: []},
	};
}

function getOnlyDecoration(decorations: ReturnType<typeof buildPrettyProjectLinkDecorations>): unknown {
	const values: unknown[] = [];
	decorations.between(0, 1_000, (_from, _to, value) => {
		values.push(value);
	});

	assert.equal(values.length, 1);
	return values[0];
}
