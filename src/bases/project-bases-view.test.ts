/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {QueryController} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {normalizeSettings} from "../settings";
import {ProjectBasesView} from "./project-bases-view";

void test("board view keeps existing DOM when plugin refresh runs before Bases data is available", () => {
	const parentEl = createTestElement("div");
	const plugin = makePlugin();
	const view = new ProjectBasesView(
		new QueryController(),
		parentEl as unknown as HTMLElement,
		plugin,
		"project-board",
		"board",
	);
	const rootEl = parentEl.children[0];
	assert.ok(rootEl);
	const existingEl = rootEl.createDiv({cls: "existing-board-content"});

	assert.doesNotThrow(() => view.render({force: true}));
	assert.ok(rootEl.children.includes(existingEl));
});

function makePlugin(): SimpleProjectViewsPlugin {
	return {
		settings: normalizeSettings({}),
		projectIndex: {
			getProject: () => null,
		},
		registerProjectBasesView: () => undefined,
		unregisterProjectBasesView: () => undefined,
	} as unknown as SimpleProjectViewsPlugin;
}

interface TestElement {
	tag: string;
	className: string;
	text: string;
	children: TestElement[];
	attributes: Record<string, string>;
	createEl: (tag: string, options?: TestElementOptions) => TestElement;
	createDiv: (options?: TestElementOptions) => TestElement;
}

interface TestElementOptions {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
}

function createTestElement(tag: string, options: TestElementOptions = {}): TestElement {
	const element: TestElement = {
		tag,
		className: options.cls ?? "",
		text: options.text ?? "",
		children: [],
		attributes: {...options.attr},
		createEl: (childTag, childOptions = {}) => {
			const childEl = createTestElement(childTag, childOptions);
			element.children.push(childEl);
			return childEl;
		},
		createDiv: (childOptions = {}) => element.createEl("div", childOptions),
	};

	return element;
}
