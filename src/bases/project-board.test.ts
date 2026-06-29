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

interface TestElement {
	tag: string;
	className: string;
	text: string;
	children: TestElement[];
	attributes: Record<string, string>;
	style: {setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void};
	classList: {toggle: (className: string, force?: boolean) => void; remove: (className: string) => void};
	draggable: boolean;
	createEl: (tag: string, options?: TestElementOptions) => TestElement;
	createSpan: (options?: TestElementOptions) => TestElement;
	createDiv: (options?: TestElementOptions) => TestElement;
	addEventListener: () => void;
	setAttribute: (name: string, value: string) => void;
	getAttribute: (name: string) => string | null;
	addClass: (className: string) => void;
	removeClass: (className: string) => void;
	closest: () => null;
	querySelectorAll: () => TestElement[];
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
			const childEl = createTestElement(childTag, childOptions);
			element.children.push(childEl);
			return childEl;
		},
		createSpan: (childOptions = {}) => element.createEl("span", childOptions),
		createDiv: (childOptions = {}) => element.createEl("div", childOptions),
		addEventListener: () => undefined,
		setAttribute: (name, value) => {
			element.attributes[name] = value;
		},
		getAttribute: (name) => element.attributes[name] ?? null,
		addClass: (className) => addClassName(element, className),
		removeClass: (className) => removeClassName(element, className),
		closest: () => null,
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
