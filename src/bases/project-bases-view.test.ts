/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {QueryController} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {ProjectIndex} from "../project-metadata";
import {DEFAULT_SETTINGS, normalizeSettings} from "../settings";
import {ProjectBasesView, type ProjectBasesVariant} from "./project-bases-view";

void test("bases views tolerate rendering before query data is available", () => {
	for (const variant of ["list", "table", "board"] as ProjectBasesVariant[]) {
		const containerEl = createTestElement("div");
		const view = new ProjectBasesView(
			new QueryController(),
			containerEl as unknown as HTMLElement,
			makePlugin(),
			`test-${variant}`,
			variant,
		);
		(view as unknown as {config: TestBasesConfig}).config = makeConfig();

		assert.doesNotThrow(() => view.render());
	}
});

void test("isolates interactive view controls from Canvas pointer handling", () => {
	const parentEl = createTestElement("div");
	new ProjectBasesView(
		new QueryController(),
		parentEl as unknown as HTMLElement,
		makePlugin(),
		"test-list",
		"list",
	);
	const viewEl = parentEl.children[0];
	assert.ok(viewEl);
	const interactiveTarget = createTestElement("button");
	const passiveTarget = createTestElement("div");

	for (const eventType of ["pointerdown", "mousedown"]) {
		let propagationStops = 0;
		viewEl.dispatchEventType(eventType, {
			target: interactiveTarget,
			stopPropagation: () => propagationStops++,
		});
		assert.equal(propagationStops, 1);

		viewEl.dispatchEventType(eventType, {
			target: passiveTarget,
			stopPropagation: () => propagationStops++,
		});
		assert.equal(propagationStops, 1);
	}
});

function makePlugin(): SimpleProjectViewsPlugin {
	return {
		settings: normalizeSettings(DEFAULT_SETTINGS),
		projectIndex: new ProjectIndex({} as never, () => normalizeSettings(DEFAULT_SETTINGS)),
		registerProjectBasesView: () => undefined,
		unregisterProjectBasesView: () => undefined,
	} as unknown as SimpleProjectViewsPlugin;
}

interface TestElement {
	tag: string;
	className: string;
	children: TestElement[];
	createDiv: (options?: TestElementOptions) => TestElement;
	listeners: Record<string, Array<(event: unknown) => void>>;
	addEventListener: (type: string, listener: (event: unknown) => void) => void;
	removeEventListener: (type: string, listener: (event: unknown) => void) => void;
	dispatchEventType: (type: string, event: unknown) => void;
	closest: (selector: string) => TestElement | null;
}

interface TestElementOptions {
	cls?: string;
}

interface TestBasesConfig {
	get: () => unknown;
	getDisplayName: (propertyId: string) => string;
	getOrder: () => string[];
	getSort: () => [];
	set: () => void;
}

function makeConfig(): TestBasesConfig {
	return {
		get: () => null,
		getDisplayName: (propertyId) => propertyId,
		getOrder: () => [],
		getSort: () => [],
		set: () => undefined,
	};
}

function createTestElement(tag: string, options: TestElementOptions = {}): TestElement {
	const element: TestElement = {
		tag,
		className: options.cls ?? "",
		children: [],
		listeners: {},
		createDiv: (childOptions = {}) => {
			const childEl = createTestElement("div", childOptions);
			element.children.push(childEl);
			return childEl;
		},
		addEventListener: (type, listener) => {
			element.listeners[type] = [...element.listeners[type] ?? [], listener];
		},
		removeEventListener: (type, listener) => {
			element.listeners[type] = (element.listeners[type] ?? []).filter((candidate) => candidate !== listener);
		},
		dispatchEventType: (type, event) => {
			for (const listener of element.listeners[type] ?? []) {
				listener(event);
			}
		},
		closest: (selector) => selector.split(",").some((candidate) => candidate.trim() === tag) ? element : null,
	};

	return element;
}
