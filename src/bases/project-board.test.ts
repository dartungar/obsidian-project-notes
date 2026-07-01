/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import type {SimpleProjectViewsSettings} from "../settings";
import {DEFAULT_SETTINGS, normalizeSettings} from "../settings";
import {getProjectBoardRenderKey, renderProjectBoard} from "./project-board";
import type {ProjectBoardRenderOptions} from "./project-board";

void test("renders a drop placeholder body for collapsed board columns", () => {
	const containerEl = createTestElement("div");
	const settings = normalizeSettings({
		statusOptions: ["todo"],
		collapsedBoardColumns: ["todo"],
	});
	const plugin = makePlugin(settings);

	renderProjectBoard(containerEl as unknown as HTMLElement, plugin, [makeProject("Projects/Apollo.md", "Apollo", "todo")], {
		editingCards: new Set(),
		fields: [],
		labels: {},
		onToggleEdit: () => undefined,
		showTitleIcon: true,
	});

	const collapsedColumn = findByClass(containerEl, "spv-board-column-collapsed");
	assert.ok(collapsedColumn);
	assert.ok(findByClass(collapsedColumn, "spv-board-column-body"));
	assert.ok(findByClass(collapsedColumn, "spv-board-card-placeholder"));
});

void test("changes the board render key only when rendered board state changes", () => {
	const settings = normalizeSettings({
		statusOptions: ["todo"],
		boardColumnOrder: ["todo"],
		boardCardOrder: ["Projects/Apollo.md"],
	});
	const options: ProjectBoardRenderOptions = {
		editingCards: new Set(),
		fields: ["progress"],
		labels: {progress: "Progress"},
		onToggleEdit: () => undefined,
		showTitleIcon: true,
	};
	const project = makeProject("Projects/Apollo.md", "Apollo", "todo", "10");
	const sameProject = makeProject("Projects/Apollo.md", "Apollo", "todo", "10");
	const changedProject = makeProject("Projects/Apollo.md", "Apollo", "todo", "20");

	assert.equal(
		getProjectBoardRenderKey([project], settings, options),
		getProjectBoardRenderKey([sameProject], settings, options),
	);
	assert.notEqual(
		getProjectBoardRenderKey([project], settings, options),
		getProjectBoardRenderKey([changedProject], settings, options),
	);
	assert.notEqual(
		getProjectBoardRenderKey([project], settings, options),
		getProjectBoardRenderKey([project], settings, {...options, editingCards: new Set([project.file.path])}),
	);
});

void test("restores card dragging when a suppressed pointer ends outside the card", () => {
	withElementGlobal(() => {
		const containerEl = createTestElement("div");
		const settings = normalizeSettings({statusOptions: ["todo"]});
		const plugin = makePlugin(settings);

		renderProjectBoard(containerEl as unknown as HTMLElement, plugin, [makeProject("Projects/Apollo.md", "Apollo", "todo")], {
			editingCards: new Set(),
			fields: [],
			labels: {},
			onToggleEdit: () => undefined,
			showTitleIcon: true,
		});

		const cardEl = findByClass(containerEl, "spv-board-card");
		assert.ok(cardEl);
		const titleButtonEl = findByClass(cardEl, "spv-project-title-button");
		assert.ok(titleButtonEl);

		cardEl.dispatchTestEvent("pointerdown", {target: titleButtonEl});
		assert.equal(cardEl.draggable, false);

		cardEl.ownerDocument.dispatchTestEvent("pointerup");
		assert.equal(cardEl.draggable, true);
	});
});

function makePlugin(settings: SimpleProjectViewsSettings): SimpleProjectViewsPlugin {
	return {
		settings,
		app: {
			workspace: {
				getLeaf: () => ({openFile: () => undefined}),
			},
		},
		refreshProjectSurfaces: () => undefined,
		saveSettings: () => Promise.resolve(),
	} as unknown as SimpleProjectViewsPlugin;
}

function makeProject(path: string, title: string, status: string, progress = ""): ProjectInfo {
	const file = new TFile();
	file.path = path;
	file.basename = title;
	return {
		file,
		title,
		icon: "",
		status,
		properties: progress
			? [{
				definition: DEFAULT_SETTINGS.projectProperties[0]!,
				raw: progress,
				value: progress,
				numberValue: Number(progress),
			}]
			: [],
		relationships: {parent: null, children: []},
	};
}

type TestEvent = {
	target?: TestElement;
};

type TestEventListener = (event: TestEvent) => void;

interface TestDocument {
	listeners: Record<string, TestEventListener[]>;
	addEventListener: (type: string, listener: TestEventListener) => void;
	removeEventListener: (type: string, listener: TestEventListener) => void;
	dispatchTestEvent: (type: string, event?: TestEvent) => void;
}

interface TestElement {
	tag: string;
	className: string;
	text: string;
	children: TestElement[];
	attributes: Record<string, string>;
	ownerDocument: TestDocument;
	parentElement: TestElement | null;
	style: {setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void};
	classList: {toggle: (className: string, force?: boolean) => void; remove: (className: string) => void};
	draggable: boolean;
	createEl: (tag: string, options?: TestElementOptions) => TestElement;
	createSpan: (options?: TestElementOptions) => TestElement;
	createDiv: (options?: TestElementOptions) => TestElement;
	addEventListener: (type: string, listener: TestEventListener) => void;
	dispatchTestEvent: (type: string, event?: TestEvent) => void;
	setAttribute: (name: string, value: string) => void;
	getAttribute: (name: string) => string | null;
	addClass: (className: string) => void;
	removeClass: (className: string) => void;
	closest: (selector: string) => TestElement | null;
	contains: (target: TestElement) => boolean;
	querySelectorAll: () => TestElement[];
}

interface TestElementOptions {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
}

function createTestDocument(): TestDocument {
	const document: TestDocument = {
		listeners: {},
		addEventListener: (type, listener) => {
			document.listeners[type] = [...(document.listeners[type] ?? []), listener];
		},
		removeEventListener: (type, listener) => {
			document.listeners[type] = (document.listeners[type] ?? []).filter((candidate) => candidate !== listener);
		},
		dispatchTestEvent: (type, event = {}) => {
			for (const listener of document.listeners[type] ?? []) {
				listener(event);
			}
		},
	};

	return document;
}

function createTestElement(
	tag: string,
	options: TestElementOptions = {},
	ownerDocument = createTestDocument(),
	parentElement: TestElement | null = null,
): TestElement {
	const listeners: Record<string, TestEventListener[]> = {};
	const element: TestElement = {
		tag,
		className: options.cls ?? "",
		text: options.text ?? "",
		children: [],
		attributes: {...options.attr},
		ownerDocument,
		parentElement,
		style: {
			setProperty: () => undefined,
			removeProperty: () => undefined,
		},
		classList: {
			toggle: (className, force) => {
				if (force === false) {
					removeClassName(element, className);
					return;
				}
				addClassName(element, className);
			},
			remove: (className) => removeClassName(element, className),
		},
		draggable: false,
		createEl: (childTag, childOptions = {}) => {
			const childEl = createTestElement(childTag, childOptions, ownerDocument, element);
			element.children.push(childEl);
			return childEl;
		},
		createSpan: (childOptions = {}) => element.createEl("span", childOptions),
		createDiv: (childOptions = {}) => element.createEl("div", childOptions),
		addEventListener: (type, listener) => {
			listeners[type] = [...(listeners[type] ?? []), listener];
		},
		dispatchTestEvent: (type, event = {}) => {
			for (const listener of listeners[type] ?? []) {
				listener({...event, target: event.target ?? element});
			}
		},
		setAttribute: (name, value) => {
			element.attributes[name] = value;
		},
		getAttribute: (name) => element.attributes[name] ?? null,
		addClass: (className) => addClassName(element, className),
		removeClass: (className) => removeClassName(element, className),
		closest: (selector) => closestTestElement(element, selector),
		contains: (target) => containsTestElement(element, target),
		querySelectorAll: () => [],
	};

	return element;
}

function findByClass(element: TestElement, className: string): TestElement | null {
	if (element.className.split(" ").includes(className)) {
		return element;
	}

	for (const childEl of element.children) {
		const result = findByClass(childEl, className);
		if (result) {
			return result;
		}
	}

	return null;
}

function closestTestElement(element: TestElement, selector: string): TestElement | null {
	let current: TestElement | null = element;
	while (current) {
		if (matchesSelector(current, selector)) {
			return current;
		}
		current = current.parentElement;
	}

	return null;
}

function containsTestElement(element: TestElement, target: TestElement): boolean {
	if (element === target) {
		return true;
	}

	return element.children.some((childEl) => containsTestElement(childEl, target));
}

function matchesSelector(element: TestElement, selector: string): boolean {
	return selector
		.split(",")
		.map((part) => part.trim())
		.some((part) => {
			if (part.startsWith(".")) {
				return element.className.split(" ").includes(part.slice(1));
			}

			return element.tag === part;
		});
}

function addClassName(element: TestElement, className: string): void {
	const classNames = new Set(element.className.split(" ").filter(Boolean));
	classNames.add(className);
	element.className = Array.from(classNames).join(" ");
}

function removeClassName(element: TestElement, className: string): void {
	element.className = element.className
		.split(" ")
		.filter((candidate) => candidate.length > 0 && candidate !== className)
		.join(" ");
}

function withElementGlobal(callback: () => void): void {
	const globalWithElement = globalThis as typeof globalThis & {Element?: typeof Element};
	const previousElement = globalWithElement.Element;
	globalWithElement.Element = Object as unknown as typeof Element;
	try {
		callback();
	} finally {
		if (previousElement) {
			globalWithElement.Element = previousElement;
		} else {
			Reflect.deleteProperty(globalWithElement, "Element");
		}
	}
}
