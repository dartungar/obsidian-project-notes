/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {TFile} from "obsidian";
import type {ProjectInfo} from "../project-metadata";
import {createProjectTitleButton} from "./project-icon";

void test("passes the click event to project title callbacks", () => {
	const containerEl = createTestElement("div");
	const project = makeProject("Projects/Apollo.md", "Apollo");
	let receivedEvent: MouseEvent | null = null;
	const onClick = (event: MouseEvent) => {
		receivedEvent = event;
	};

	const buttonEl = createProjectTitleButton(containerEl as unknown as HTMLElement, project, onClick);
	const clickEvent = {ctrlKey: true, metaKey: false} as MouseEvent;
	(buttonEl as unknown as TestElement).dispatchEventType("click", clickEvent);

	assert.equal(receivedEvent, clickEvent);
});

function makeProject(path: string, title: string): ProjectInfo {
	const file = new TFile();
	file.path = path;
	file.basename = title;
	return {
		file,
		title,
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
	listeners: Record<string, Array<(event: unknown) => void>>;
	createEl: (tag: string, options?: TestElementOptions) => TestElement;
	createSpan: (options?: TestElementOptions) => TestElement;
	addEventListener: (type: string, listener: (event: unknown) => void) => void;
	dispatchEventType: (type: string, event: unknown) => void;
}

interface TestElementOptions {
	cls?: string;
	text?: string;
}

function createTestElement(tag: string, options: TestElementOptions = {}): TestElement {
	const element: TestElement = {
		tag,
		className: options.cls ?? "",
		text: options.text ?? "",
		children: [],
		listeners: {},
		createEl: (childTag, childOptions = {}) => {
			const childEl = createTestElement(childTag, childOptions);
			element.children.push(childEl);
			return childEl;
		},
		createSpan: (childOptions = {}) => element.createEl("span", childOptions),
		addEventListener: (type, listener) => {
			element.listeners[type] = [...element.listeners[type] ?? [], listener];
		},
		dispatchEventType: (type, event) => {
			for (const listener of element.listeners[type] ?? []) {
				listener(event);
			}
		},
	};

	return element;
}
