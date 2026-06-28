/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import type {EditorView, ViewUpdate} from "@codemirror/view";
import {
	hasPrettyProjectLinkRefreshEffect,
	refreshPrettyProjectLinkLivePreviewEditors,
	shouldIgnorePrettyProjectLinkWidgetEvent,
	shouldRenderPrettyProjectLinkRange,
	trackPrettyProjectLinkLivePreviewView,
	untrackPrettyProjectLinkLivePreviewView,
} from "./pretty-project-link-live-preview";

void test("dispatches refresh effects to tracked Live Preview editors", () => {
	const dispatchedEffects: unknown[] = [];
	const view = {
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

function makeSelectionView(from: number, to: number): EditorView {
	return {
		state: {
			selection: {
				ranges: [{from, to}],
			},
		},
	} as unknown as EditorView;
}
