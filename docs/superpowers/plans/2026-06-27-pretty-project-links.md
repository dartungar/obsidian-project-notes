# Pretty Project Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render links to project notes as configurable pretty project links in Reading view and Live Preview, with project-aware right-click actions.

**Architecture:** Add settings for pretty-link enablement and field selection, then introduce focused UI modules for field selection, shared rendering, context menus, Reading view processing, and Live Preview decorations. Reading view uses Obsidian markdown post-processing; Live Preview uses a CodeMirror `ViewPlugin` registered through Obsidian's editor extension API.

**Tech Stack:** TypeScript, Obsidian plugin API, CodeMirror 6 decorations, esbuild, Node test runner.

---

## File Structure

- Modify `src/settings.ts`: add settings fields, tab entry, normalizers, and Pretty links settings UI.
- Modify `src/settings.test.ts`: cover settings normalization.
- Create `src/ui/pretty-project-link-fields.ts`: pure helpers for ordered visible pretty-link fields.
- Create `src/ui/pretty-project-link-fields.test.ts`: cover pure field selection.
- Create `src/ui/project-link-menu.ts`: shared right-click menu for project links.
- Create `src/ui/pretty-project-link-renderer.ts`: shared DOM renderer and link resolution.
- Create `src/ui/pretty-project-links.ts`: Reading view markdown postprocessor.
- Create `src/ui/pretty-project-link-live-preview.ts`: CodeMirror Live Preview decorations.
- Modify `src/main.ts`: register both adapters and refresh/reconfigure pretty links.
- Modify `src/test-obsidian.ts`: add test doubles for APIs used by new modules.
- Modify `src/test-runner.ts`: include new tests.
- Modify `styles.css`: compact pretty-link styles.

---

### Task 1: Settings Model And UI

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/settings.test.ts`

- [ ] **Step 1: Write failing settings tests**

Add these imports in `src/settings.test.ts`:

```ts
import {
	DEFAULT_SETTINGS,
	getOrderedPrettyLinkFields,
	normalizePrettyLinkFields,
} from "./settings";
```

Add these tests:

```ts
void test("uses default pretty link settings", () => {
	const settings = normalizeSettings();

	assert.equal(settings.prettyLinksEnabled, true);
	assert.deepEqual(settings.prettyLinkFields, ["status"]);
	assert.deepEqual(DEFAULT_SETTINGS.prettyLinkFields, ["status"]);
});

void test("normalizes pretty link fields", () => {
	const settings = normalizeSettings({
		prettyLinkFields: [" due ", "", "status", "unknown", "due", "nextAction"],
	});

	assert.deepEqual(settings.prettyLinkFields, ["status", "due", "nextAction"]);
});

void test("allows title-only pretty links", () => {
	const settings = normalizeSettings({
		prettyLinkFields: [],
	});

	assert.deepEqual(settings.prettyLinkFields, []);
});

void test("orders pretty link fields from current project properties", () => {
	const settings = normalizeSettings({
		prettyLinkFields: ["nextAction", "status", "due"],
	});

	assert.deepEqual(getOrderedPrettyLinkFields(settings, new Set(settings.prettyLinkFields)), [
		"status",
		"due",
		"nextAction",
	]);
});

void test("normalizes pretty links enabled", () => {
	assert.equal(normalizeSettings({prettyLinksEnabled: false}).prettyLinksEnabled, false);
	assert.equal(normalizeSettings({prettyLinksEnabled: "false" as never}).prettyLinksEnabled, true);
});
```

- [ ] **Step 2: Run failing settings tests**

Run: `npm test`

Expected: FAIL with missing exports or missing `prettyLinksEnabled` / `prettyLinkFields`.

- [ ] **Step 3: Implement settings fields and normalizers**

In `src/settings.ts`, extend the tab type:

```ts
type SettingsTabId = "general" | "views" | "noteBar" | "prettyLinks" | "relationships" | "statuses" | "properties";
```

Add to `SimpleProjectViewsSettings`:

```ts
	prettyLinksEnabled: boolean;
	prettyLinkFields: string[];
```

Add to `DEFAULT_SETTINGS` near note toolbar settings:

```ts
	prettyLinksEnabled: true,
	prettyLinkFields: ["status"],
```

Add to `TAB_LABELS`:

```ts
	prettyLinks: "Pretty links",
```

In `normalizeSettings`, compute normalized fields after `projectProperties`:

```ts
	const prettyLinkFields = normalizePrettyLinkFields(settings.prettyLinkFields, projectProperties);
```

Add these returned properties:

```ts
		prettyLinksEnabled: readBoolean(settings.prettyLinksEnabled, DEFAULT_SETTINGS.prettyLinksEnabled),
		prettyLinkFields,
```

Add helpers:

```ts
export function normalizePrettyLinkFields(
	value: unknown,
	projectProperties = DEFAULT_SETTINGS.projectProperties,
): string[] {
	if (!Array.isArray(value)) {
		return [...DEFAULT_SETTINGS.prettyLinkFields];
	}

	const allowedFields = new Set([
		"status",
		...projectProperties
			.filter((property) => property.name.trim().length > 0)
			.map((property) => property.id),
	]);
	const requestedFields = new Set(normalizeStringList(value).filter((field) => allowedFields.has(field)));
	return getOrderedPrettyLinkFields({projectProperties} as SimpleProjectViewsSettings, requestedFields);
}

export function getOrderedPrettyLinkFields(
	settings: Pick<SimpleProjectViewsSettings, "projectProperties">,
	fields: Set<string>,
): string[] {
	const orderedFields = [
		"status",
		...settings.projectProperties
			.filter((property) => property.name.trim().length > 0)
			.map((property) => property.id),
	];

	return orderedFields.filter((field) => fields.has(field));
}
```

- [ ] **Step 4: Implement Pretty links settings tab**

In `display()`, add the branch before relationships:

```ts
		} else if (this.activeTab === "prettyLinks") {
			this.displayPrettyLinks(containerEl);
```

Add methods:

```ts
	private displayPrettyLinks(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Pretty links");

		new Setting(containerEl)
			.setName("Enable pretty links")
			.setDesc("Render links to project notes as compact project links.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.prettyLinksEnabled)
					.onChange(async (value) => {
						this.plugin.settings.prettyLinksEnabled = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.addHeading(containerEl, "Fields");
		this.addPrettyLinkFieldSetting(containerEl, "status", "Status");
		for (const property of this.plugin.settings.projectProperties) {
			if (property.name.trim()) {
				this.addPrettyLinkFieldSetting(containerEl, property.id, property.label || property.name);
			}
		}
	}

	private addPrettyLinkFieldSetting(containerEl: HTMLElement, field: string, label: string): void {
		const enabledFields = new Set(this.plugin.settings.prettyLinkFields);

		new Setting(containerEl)
			.setName(label)
			.setDesc("Show this field on pretty project links.")
			.addToggle((toggle) => {
				toggle
					.setValue(enabledFields.has(field))
					.setDisabled(!this.plugin.settings.prettyLinksEnabled)
					.onChange(async (value) => {
						this.plugin.settings.prettyLinkFields = this.getPrettyLinkFields(field, value);
						await this.plugin.saveSettings();
					});
			});
	}

	private getPrettyLinkFields(field: string, enabled: boolean): string[] {
		const fields = new Set(this.plugin.settings.prettyLinkFields);
		if (enabled) {
			fields.add(field);
		} else {
			fields.delete(field);
		}

		return getOrderedPrettyLinkFields(this.plugin.settings, fields);
	}
```

- [ ] **Step 5: Run settings tests**

Run: `npm test`

Expected: PASS.

---

### Task 2: Pretty Link Field Selection Helpers

**Files:**
- Create: `src/ui/pretty-project-link-fields.ts`
- Create: `src/ui/pretty-project-link-fields.test.ts`
- Modify: `src/test-runner.ts`

- [ ] **Step 1: Write failing field helper tests**

Create `src/ui/pretty-project-link-fields.test.ts`:

```ts
/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSettings} from "../settings";
import type {ProjectInfo} from "../project-metadata";
import {getPrettyLinkVisibleFields} from "./pretty-project-link-fields";

void test("selects status and non-empty configured properties", () => {
	const settings = normalizeSettings({
		prettyLinkFields: ["status", "due", "nextAction"],
	});
	const project = makeProject({
		status: "in-progress",
		properties: [
			{definition: settings.projectProperties.find((property) => property.id === "due")!, raw: "2026-07-01", value: "2026-07-01", numberValue: null},
			{definition: settings.projectProperties.find((property) => property.id === "nextAction")!, raw: "", value: "", numberValue: null},
		],
	});

	assert.deepEqual(getPrettyLinkVisibleFields(settings, project), ["status", "due"]);
});

void test("keeps status visible when status is selected but empty", () => {
	const settings = normalizeSettings({
		prettyLinkFields: ["status"],
	});

	assert.deepEqual(getPrettyLinkVisibleFields(settings, makeProject({status: ""})), ["status"]);
});

void test("returns no fields when pretty links are title-only", () => {
	const settings = normalizeSettings({
		prettyLinkFields: [],
	});

	assert.deepEqual(getPrettyLinkVisibleFields(settings, makeProject({status: "todo"})), []);
});

function makeProject(project: Partial<ProjectInfo>): ProjectInfo {
	return {
		file: {path: "Projects/Test.md", basename: "Test"} as ProjectInfo["file"],
		title: "Test",
		icon: "",
		status: "",
		properties: [],
		relationships: {parent: null, children: []},
		...project,
	};
}
```

Add to `src/test-runner.ts`:

```ts
import "./ui/pretty-project-link-fields.test";
```

- [ ] **Step 2: Run failing helper tests**

Run: `npm test`

Expected: FAIL because `pretty-project-link-fields.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `src/ui/pretty-project-link-fields.ts`:

```ts
import {getProjectPropertyById, isProjectPropertyEmpty} from "../project-properties";
import type {ProjectInfo} from "../project-metadata";
import type {SimpleProjectViewsSettings} from "../settings";

export function getPrettyLinkVisibleFields(
	settings: SimpleProjectViewsSettings,
	project: ProjectInfo,
): string[] {
	return settings.prettyLinkFields.filter((field) => {
		if (field === "status") {
			return true;
		}

		const property = getProjectPropertyById(project.properties, field);
		return property !== undefined && !isProjectPropertyEmpty(property);
	});
}
```

- [ ] **Step 4: Run helper tests**

Run: `npm test`

Expected: PASS.

---

### Task 3: Shared Renderer And Project Menu

**Files:**
- Create: `src/ui/project-link-menu.ts`
- Create: `src/ui/pretty-project-link-renderer.ts`
- Modify: `src/test-obsidian.ts`

- [ ] **Step 1: Extend Obsidian test double types**

In `src/test-obsidian.ts`, update imports/classes as needed:

```ts
export class Menu {
	static forEvent(_event: MouseEvent): Menu {
		return new Menu();
	}

	addItem(_callback: (item: MenuItem) => void): this {
		return this;
	}

	addSeparator(): this {
		return this;
	}

	showAtMouseEvent(_event: MouseEvent): this {
		return this;
	}
}

export class MenuItem {
	setTitle(_title: string | DocumentFragment): this {
		return this;
	}

	setIcon(_icon: string | null): this {
		return this;
	}

	setChecked(_checked: boolean | null): this {
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	setWarning(_warning: boolean): this {
		return this;
	}

	setSection(_section: string): this {
		return this;
	}

	onClick(_callback: (event?: MouseEvent | KeyboardEvent) => void): this {
		return this;
	}
}
```

- [ ] **Step 2: Implement project context menu**

Create `src/ui/project-link-menu.ts`:

```ts
import {Menu, Notice} from "obsidian";
import type {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {updateProjectProperty} from "../project-metadata";
import {getProjectPropertyById, normalizePropertyInputValue} from "../project-properties";

export function showProjectLinkMenu(
	event: MouseEvent,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	sourcePath: string,
): void {
	event.preventDefault();
	event.stopPropagation();

	const menu = Menu.forEvent(event);
	menu.addItem((item) => {
		item
			.setTitle("Open note")
			.setIcon("file-text")
			.onClick(() => {
				void plugin.app.workspace.getLeaf(false).openFile(project.file);
			});
	});

	if (plugin.settings.statusOptions.length > 0 && plugin.settings.propertyNames.status.trim()) {
		menu.addSeparator();
		for (const status of plugin.settings.statusOptions) {
			menu.addItem((item) => {
				item
					.setTitle(status || "No status")
					.setIcon("circle")
					.setChecked(project.status === status)
					.onClick(() => {
						void updateProjectLinkStatus(plugin, project, status);
					});
			});
		}
	}

	const editableProperties = plugin.settings.projectProperties.filter((property) => property.name.trim().length > 0);
	if (editableProperties.length > 0) {
		menu.addSeparator();
		for (const definition of editableProperties) {
			const property = getProjectPropertyById(project.properties, definition.id);
			menu.addItem((item) => {
				item
					.setTitle(`Clear ${definition.label || definition.name}`)
					.setIcon("eraser")
					.setDisabled(!property || normalizePropertyInputValue(definition, property.value) === null)
					.onClick(() => {
						void updateProjectLinkProperty(plugin, project, definition.name, null);
					});
			});
		}
	}

	menu.addSeparator();
	menu.addItem((item) => {
		item
			.setTitle("Note actions")
			.setIcon("more-horizontal")
			.onClick((clickEvent) => {
				showNativeNoteActions(plugin, project.file, sourcePath, clickEvent);
			});
	});

	menu.showAtMouseEvent(event);
}

async function updateProjectLinkStatus(
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	status: string,
): Promise<void> {
	await updateProjectLinkProperty(plugin, project, plugin.settings.propertyNames.status, status || null);
}

async function updateProjectLinkProperty(
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	propertyName: string,
	value: string | number | null,
): Promise<void> {
	try {
		await updateProjectProperty(plugin.app, project.file, propertyName, value);
		plugin.refreshProjectSurfaces();
	} catch (error) {
		console.error("Simple project views: could not update pretty link project property", error);
		new Notice("Could not update project property");
	}
}

function showNativeNoteActions(
	plugin: SimpleProjectViewsPlugin,
	file: TFile,
	sourcePath: string,
	event: MouseEvent | KeyboardEvent | undefined,
): void {
	const menu = new Menu();
	const leaf = plugin.app.workspace.getMostRecentLeaf?.() ?? undefined;
	const handled = plugin.app.workspace.handleLinkContextMenu(menu, file.path, sourcePath, leaf ?? undefined);
	if (!handled) {
		plugin.app.workspace.trigger?.("file-menu", menu, file, "simple-project-views", leaf ?? undefined);
	}

	if (event instanceof MouseEvent) {
		menu.showAtMouseEvent(event);
	} else {
		menu.showAtPosition({x: 0, y: 0});
	}
}
```

- [ ] **Step 3: Implement shared pretty link renderer**

Create `src/ui/pretty-project-link-renderer.ts`:

```ts
import {parseLinktext, setIcon} from "obsidian";
import type {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {renderProjectControls} from "./project-controls";
import {getPrettyLinkVisibleFields} from "./pretty-project-link-fields";
import {showProjectLinkMenu} from "./project-link-menu";

export interface PrettyProjectLinkData {
	project: ProjectInfo;
	file: TFile;
	sourcePath: string;
	linktext: string;
	label: string;
}

export function resolvePrettyProjectLink(
	plugin: SimpleProjectViewsPlugin,
	linktext: string,
	sourcePath: string,
	label = "",
): PrettyProjectLinkData | null {
	if (!plugin.settings.prettyLinksEnabled) {
		return null;
	}

	const parsed = parseLinktext(linktext);
	if (parsed.subpath) {
		return null;
	}

	const file = plugin.app.metadataCache.getFirstLinkpathDest(parsed.path, sourcePath);
	if (!file) {
		return null;
	}

	const project = plugin.projectIndex.getProject(file);
	if (!project) {
		return null;
	}

	return {
		project,
		file,
		sourcePath,
		linktext,
		label: label.trim() || project.title,
	};
}

export function renderPrettyProjectLink(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	data: PrettyProjectLinkData,
): HTMLElement {
	const linkEl = containerEl.createEl("span", {
		cls: "spv-pretty-project-link",
		attr: {
			role: "link",
			tabindex: "0",
			"data-href": data.linktext,
			"data-spv-project-path": data.file.path,
		},
	});

	const titleEl = linkEl.createSpan({cls: "spv-pretty-project-link-title"});
	if (data.project.icon) {
		const iconEl = titleEl.createSpan({cls: "spv-project-icon spv-pretty-project-link-icon", attr: {"aria-hidden": "true"}});
		setIcon(iconEl, data.project.icon);
	}
	titleEl.createSpan({cls: "spv-pretty-project-link-label", text: data.label});

	const fields = getPrettyLinkVisibleFields(plugin.settings, data.project);
	if (fields.length > 0) {
		renderProjectControls(linkEl, plugin.app, plugin.settings, data.project, {
			compact: true,
			controlClass: "spv-pretty-project-link-fields",
			fields,
			readOnly: true,
		});
	}

	linkEl.addEventListener("click", (event) => {
		if (event.defaultPrevented) {
			return;
		}

		event.preventDefault();
		void plugin.app.workspace.getLeaf(event.ctrlKey || event.metaKey).openFile(data.file);
	});
	linkEl.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}

		event.preventDefault();
		void plugin.app.workspace.getLeaf(false).openFile(data.file);
	});
	linkEl.addEventListener("contextmenu", (event) => {
		showProjectLinkMenu(event, plugin, data.project, data.sourcePath);
	});

	return linkEl;
}
```

- [ ] **Step 4: Run typecheck through tests**

Run: `npm test`

Expected: PASS.

---

### Task 4: Reading View Postprocessor

**Files:**
- Create: `src/ui/pretty-project-links.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement Reading view processor**

Create `src/ui/pretty-project-links.ts`:

```ts
import type {MarkdownPostProcessorContext} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {renderPrettyProjectLink, resolvePrettyProjectLink} from "./pretty-project-link-renderer";

const PROCESSED_ATTR = "data-spv-pretty-project-link-processed";

export function registerPrettyProjectLinks(plugin: SimpleProjectViewsPlugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		renderPrettyProjectLinksInReadingView(plugin, el, ctx);
	});
}

function renderPrettyProjectLinksInReadingView(
	plugin: SimpleProjectViewsPlugin,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): void {
	if (!plugin.settings.prettyLinksEnabled) {
		return;
	}

	for (const linkEl of Array.from(el.querySelectorAll<HTMLAnchorElement>("a.internal-link"))) {
		if (linkEl.getAttribute(PROCESSED_ATTR) === "true") {
			continue;
		}

		linkEl.setAttribute(PROCESSED_ATTR, "true");
		const linktext = linkEl.getAttribute("data-href") ?? linkEl.getAttribute("href") ?? "";
		if (!linktext) {
			continue;
		}

		const data = resolvePrettyProjectLink(plugin, linktext, ctx.sourcePath, linkEl.textContent ?? "");
		if (!data) {
			continue;
		}

		const wrapperEl = document.createElement("span");
		renderPrettyProjectLink(wrapperEl, plugin, data);
		const prettyLinkEl = wrapperEl.firstElementChild;
		if (prettyLinkEl) {
			linkEl.replaceWith(prettyLinkEl);
		}
	}
}
```

- [ ] **Step 2: Wire Reading view registration**

In `src/main.ts`, import and call:

```ts
import {registerPrettyProjectLinks} from "./ui/pretty-project-links";
```

In `onload()` after refresh events registration:

```ts
		registerPrettyProjectLinks(this);
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

---

### Task 5: Live Preview Decorations

**Files:**
- Create: `src/ui/pretty-project-link-live-preview.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement Live Preview editor extension**

Create `src/ui/pretty-project-link-live-preview.ts`:

```ts
import {RangeSetBuilder} from "@codemirror/state";
import type {Extension} from "@codemirror/state";
import {Decoration, EditorView, ViewPlugin, WidgetType} from "@codemirror/view";
import type {DecorationSet, ViewUpdate} from "@codemirror/view";
import {editorInfoField} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {renderPrettyProjectLink, resolvePrettyProjectLink} from "./pretty-project-link-renderer";
import type {PrettyProjectLinkData} from "./pretty-project-link-renderer";

const WIKI_LINK_REGEX = /!?\[\[([^\]\n]+)\]\]/g;

export function createPrettyProjectLinkLivePreviewExtension(plugin: SimpleProjectViewsPlugin): Extension {
	const prettyLinkPlugin = ViewPlugin.fromClass(class {
		decorations: DecorationSet;

		constructor(private readonly view: EditorView) {
			this.decorations = this.buildDecorations();
		}

		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = this.buildDecorations();
			}
		}

		private buildDecorations(): DecorationSet {
			if (!plugin.settings.prettyLinksEnabled) {
				return Decoration.none;
			}

			const sourcePath = getSourcePath(this.view);
			if (!sourcePath) {
				return Decoration.none;
			}

			const builder = new RangeSetBuilder<Decoration>();
			for (const range of this.view.visibleRanges) {
				const text = this.view.state.doc.sliceString(range.from, range.to);
				WIKI_LINK_REGEX.lastIndex = 0;
				let match: RegExpExecArray | null;
				while ((match = WIKI_LINK_REGEX.exec(text)) !== null) {
					if (match[0].startsWith("!")) {
						continue;
					}

					const from = range.from + match.index;
					const to = from + match[0].length;
					if (selectionIntersects(this.view, from, to)) {
						continue;
					}

					const linkBody = match[1] ?? "";
					const [linktext, alias] = splitLinkAlias(linkBody);
					const data = resolvePrettyProjectLink(plugin, linktext, sourcePath, alias);
					if (!data) {
						continue;
					}

					builder.add(from, to, Decoration.replace({
						widget: new PrettyProjectLinkWidget(plugin, data),
						inclusive: false,
					}));
				}
			}

			return builder.finish();
		}
	}, {
		decorations: (value) => value.decorations,
	});

	return prettyLinkPlugin;
}

class PrettyProjectLinkWidget extends WidgetType {
	constructor(
		private readonly plugin: SimpleProjectViewsPlugin,
		private readonly data: PrettyProjectLinkData,
	) {
		super();
	}

	toDOM(): HTMLElement {
		const wrapperEl = document.createElement("span");
		renderPrettyProjectLink(wrapperEl, this.plugin, this.data);
		return wrapperEl.firstElementChild as HTMLElement;
	}

	eq(other: PrettyProjectLinkWidget): boolean {
		return this.data.file.path === other.data.file.path
			&& this.data.label === other.data.label
			&& this.data.project.status === other.data.project.status
			&& this.plugin.settings.prettyLinkFields.join("|") === other.plugin.settings.prettyLinkFields.join("|");
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function getSourcePath(view: EditorView): string {
	const info = view.state.field(editorInfoField, false);
	const file = info?.file;
	return file?.path ?? "";
}

function splitLinkAlias(value: string): [string, string] {
	const pipeIndex = value.indexOf("|");
	if (pipeIndex === -1) {
		return [value, ""];
	}

	return [value.slice(0, pipeIndex), value.slice(pipeIndex + 1)];
}

function selectionIntersects(view: EditorView, from: number, to: number): boolean {
	return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}
```

- [ ] **Step 2: Wire Live Preview extension registration**

In `src/main.ts`, import and register:

```ts
import {createPrettyProjectLinkLivePreviewExtension} from "./ui/pretty-project-link-live-preview";
```

In `onload()` after creating `projectToolbar`:

```ts
		this.registerEditorExtension(createPrettyProjectLinkLivePreviewExtension(this));
```

In `refreshProjectSurfaces()`, request editor reconfiguration through workspace update options:

```ts
		this.app.workspace.updateOptions();
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

---

### Task 6: Styles And Final Verification

**Files:**
- Modify: `styles.css`
- Modify: `README.md`

- [ ] **Step 1: Add compact styles**

Add to `styles.css` near the project controls styles:

```css
.spv-pretty-project-link {
	align-items: baseline;
	background: var(--background-secondary);
	border: var(--border-width, 1px) solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	color: var(--text-normal);
	cursor: pointer;
	display: inline-flex;
	flex-wrap: wrap;
	gap: 0 var(--size-2-2);
	line-height: var(--line-height-tight);
	margin-inline: 1px;
	max-width: 100%;
	padding: 1px var(--size-2-2);
	text-decoration: none;
	vertical-align: baseline;
}

.spv-pretty-project-link:hover,
.spv-pretty-project-link:focus-visible {
	border-color: var(--interactive-accent);
	color: var(--text-normal);
	outline: none;
}

.spv-pretty-project-link-title {
	align-items: center;
	display: inline-flex;
	gap: var(--size-2-1);
	min-width: 0;
}

.spv-pretty-project-link-label {
	font-weight: var(--font-medium);
	overflow-wrap: anywhere;
}

.spv-pretty-project-link-fields.spv-project-summary-fields {
	align-items: center;
	display: inline-flex;
	flex-wrap: wrap;
	gap: var(--size-2-1) var(--size-2-2);
	margin: 0;
	width: auto;
}

.spv-pretty-project-link-fields .spv-summary-item {
	display: inline-flex;
	gap: var(--size-2-1);
}

.spv-pretty-project-link-fields .spv-summary-progress {
	min-width: 5rem;
}
```

- [ ] **Step 2: Update README feature list**

Add one bullet:

```md
- Pretty project links in Reading view and Live Preview, with configurable fields and project actions.
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Review changed files**

Run: `git status --short`

Expected: modified source, tests, styles, README, and the new plan file. No `main.js` or other generated artifacts should be committed.
