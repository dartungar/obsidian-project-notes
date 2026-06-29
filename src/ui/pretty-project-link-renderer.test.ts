/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {normalizeSettings} from "../settings";
import {
	getPrettyProjectLinkAttributes,
	handlePrettyProjectLinkMouseDown,
	readPrettyProjectLinkAttributes,
	resolvePrettyProjectLink,
	renderPrettyProjectLink,
} from "./pretty-project-link-renderer";

void test("resolves a project note link into pretty link data", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const plugin = makePlugin(file, project);

	const data = resolvePrettyProjectLink(plugin, "Projects/Apollo", "Daily.md", "Apollo project");

	assert.equal(data?.file, file);
	assert.equal(data?.project, project);
	assert.equal(data?.sourcePath, "Daily.md");
	assert.equal(data?.linktext, "Projects/Apollo");
	assert.equal(data?.label, "Apollo project");
});

void test("uses project title when link label is empty", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const plugin = makePlugin(file, project);

	const data = resolvePrettyProjectLink(plugin, "Projects/Apollo", "Daily.md");

	assert.equal(data?.label, "Apollo");
});

void test("does not resolve disabled, subpath, unresolved, or non-project links", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const disabledPlugin = makePlugin(file, project, {prettyLinksEnabled: false});
	const plugin = makePlugin(file, null);

	assert.equal(resolvePrettyProjectLink(disabledPlugin, "Projects/Apollo", "Daily.md"), null);
	assert.equal(resolvePrettyProjectLink(makePlugin(file, project), "Projects/Apollo#Heading", "Daily.md"), null);
	assert.equal(resolvePrettyProjectLink(makePlugin(null, null), "Projects/Missing", "Daily.md"), null);
	assert.equal(resolvePrettyProjectLink(plugin, "Projects/Apollo", "Daily.md"), null);
});

void test("round trips pretty link refresh attributes", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const data = {
		file,
		project: makeProject(file),
		sourcePath: "Daily.md",
		linktext: "Projects/Apollo",
		label: "Apollo project",
	};
	const attributes = getPrettyProjectLinkAttributes(data);
	const element = {
		getAttribute: (name: string) => attributes[name],
	} as HTMLElement;

	assert.deepEqual(readPrettyProjectLinkAttributes(element), {
		sourcePath: "Daily.md",
		linktext: "Projects/Apollo",
		label: "Apollo project",
	});
});

void test("keeps mouse down on pretty links from moving the editor selection", () => {
	let prevented = false;
	let stopped = false;
	const event = {
		preventDefault: () => {
			prevented = true;
		},
		stopPropagation: () => {
			stopped = true;
		},
	} as MouseEvent;

	handlePrettyProjectLinkMouseDown(event);

	assert.equal(prevented, true);
	assert.equal(stopped, true);
});

void test("hides pretty link property names when disabled", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	project.status = "done";
	const plugin = makePlugin(file, project, {prettyLinkShowPropertyNames: false} as never);
	const containerEl = createTestElement("div");

	const linkEl = renderPrettyProjectLink(containerEl as unknown as HTMLElement, plugin, {
		file,
		project,
		sourcePath: "Daily.md",
		linktext: "Projects/Apollo",
		label: "Apollo",
	});

	assert.deepEqual(findTextByClass(linkEl as unknown as TestElement, "spv-summary-label"), []);
	assert.deepEqual(findTextByClass(linkEl as unknown as TestElement, "spv-status-badge"), ["done"]);
});

function makePlugin(
	resolvedFile: TFile | null,
	project: ProjectInfo | null,
	settings: Partial<ReturnType<typeof normalizeSettings>> = {},
): SimpleProjectViewsPlugin {
	return {
		settings: normalizeSettings(settings),
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

interface TestElement {
	tag: string;
	className: string;
	text: string;
	children: TestElement[];
	attributes: Record<string, string>;
	style: {setProperty: (name: string, value: string) => void};
	createEl: (tag: string, options?: TestElementOptions) => TestElement;
	createSpan: (options?: TestElementOptions) => TestElement;
	createDiv: (options?: TestElementOptions) => TestElement;
	addEventListener: () => void;
	setAttribute: (name: string, value: string) => void;
	getAttribute: (name: string) => string | null;
	remove: () => void;
	addClass: (className: string) => void;
	childElementCount: number;
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
		style: {setProperty: () => undefined},
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
		remove: () => undefined,
		addClass: (className) => {
			element.className = `${element.className} ${className}`.trim();
		},
		get childElementCount() {
			return element.children.length;
		},
	};

	return element;
}

function findTextByClass(element: TestElement, className: string): string[] {
	const ownText = element.className.split(" ").includes(className) ? [element.text] : [];
	return [
		...ownText,
		...element.children.flatMap((childEl) => findTextByClass(childEl, className)),
	];
}
