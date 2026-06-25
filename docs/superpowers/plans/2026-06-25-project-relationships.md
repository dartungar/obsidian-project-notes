# Project Relationships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable parent and children project note relationships whose source of truth is always the current note's own properties.

**Architecture:** Settings owns relationship property names. `project-frontmatter.ts` owns YAML scalar/list writes. `project-relationships.ts` owns pure relationship parsing and link formatting. `ProjectIndex` attaches relationships to `ProjectInfo`, `ProjectNoteToolbar` renders them through a focused UI helper, and `main.ts` orchestrates the create-child command.

**Tech Stack:** TypeScript, Obsidian plugin APIs, node:test, esbuild, npm scripts.

---

## File Structure

- Modify `src/settings.ts`: add relationship settings, normalization, and a **Relationships** settings tab.
- Create `src/settings.test.ts`: tests for default and trimmed relationship property names.
- Modify `src/test-runner.ts`: import new settings and relationship tests.
- Modify `src/project-frontmatter.ts`: add list append/update support while preserving existing scalar behavior.
- Modify `src/project-frontmatter.test.ts`: add failing tests for children list writes.
- Create `src/project-relationships.ts`: pure parsing of parent/children frontmatter and helper for Obsidian file links.
- Create `src/project-relationships.test.ts`: tests for relationship reads from scalar/list frontmatter values.
- Modify `src/project-metadata.ts`: add relationships to `ProjectInfo` and add a vault helper for appending list properties.
- Create `src/ui/project-relationship-controls.ts`: render parent/children links and create-child button on the note bar.
- Modify `src/ui/project-note-toolbar.ts`: call relationship rendering after existing project controls.
- Modify `src/ui/create-project-modal.ts`: accept optional title, submit label, error message, and creation callback.
- Modify `src/main.ts`: register the create-child command and implement child creation updates.
- Modify `styles.css`: add compact note bar relationship styling.

## Task 1: Relationship Settings

**Files:**
- Modify: `src/settings.ts:25-190`
- Create: `src/settings.test.ts`
- Modify: `src/test-runner.ts`

- [ ] **Step 1: Write the failing settings tests**

Add `src/settings.test.ts`:

```ts
/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSettings} from "./settings";

void test("uses default relationship property names", () => {
	const settings = normalizeSettings();

	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent",
		children: "children",
	});
});

void test("trims configured relationship property names", () => {
	const settings = normalizeSettings({
		relationshipPropertyNames: {
			parent: " parent_project ",
			children: " child_projects ",
		},
	});

	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent_project",
		children: "child_projects",
	});
});

void test("falls back when relationship property names are empty", () => {
	const settings = normalizeSettings({
		relationshipPropertyNames: {
			parent: " ",
			children: "",
		},
	});

	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent",
		children: "children",
	});
});
```

Update `src/test-runner.ts`:

```ts
import "./bases/view-properties.test";
import "./bases/table-sorting.test";
import "./project-frontmatter.test";
import "./settings.test";
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `relationshipPropertyNames` does not exist on normalized settings.

- [ ] **Step 3: Implement relationship settings**

In `src/settings.ts`, change the tab type:

```ts
type SettingsTabId = "general" | "views" | "noteBar" | "relationships" | "statuses" | "properties";
```

Add the settings interface:

```ts
export interface ProjectRelationshipPropertyNames {
	parent: string;
	children: string;
}
```

Add the field to `SimpleProjectViewsSettings`:

```ts
relationshipPropertyNames: ProjectRelationshipPropertyNames;
```

Add defaults to `DEFAULT_SETTINGS` after `propertyNames`:

```ts
relationshipPropertyNames: {
	parent: "parent",
	children: "children",
},
```

Add the tab label:

```ts
relationships: "Relationships",
```

In `normalizeSettings`, compute and return the normalized relationship names:

```ts
const relationshipPropertyNames = normalizeProjectRelationshipPropertyNames(settings.relationshipPropertyNames);
```

and include it in the returned object after `propertyNames`:

```ts
relationshipPropertyNames,
```

Add this helper near `normalizeProjectPropertyNames`:

```ts
function normalizeProjectRelationshipPropertyNames(value: unknown): ProjectRelationshipPropertyNames {
	const propertyNames = isRecord(value) ? value : {};

	return {
		parent: readNonEmptyString(propertyNames.parent) ?? DEFAULT_SETTINGS.relationshipPropertyNames.parent,
		children: readNonEmptyString(propertyNames.children) ?? DEFAULT_SETTINGS.relationshipPropertyNames.children,
	};
}
```

Add this helper near `readString`:

```ts
function readNonEmptyString(value: unknown): string | null {
	const stringValue = readString(value);
	return stringValue && stringValue.length > 0 ? stringValue : null;
}
```

Update `display()` routing:

```ts
if (this.activeTab === "general") {
	this.displayGeneral(containerEl);
} else if (this.activeTab === "views") {
	this.displayViews(containerEl);
} else if (this.activeTab === "noteBar") {
	this.displayNoteBar(containerEl);
} else if (this.activeTab === "relationships") {
	this.displayRelationships(containerEl);
} else if (this.activeTab === "statuses") {
	this.displayStatuses(containerEl);
} else {
	this.displayProperties(containerEl);
}
```

Add this settings tab method after `displayNoteBar`:

```ts
private displayRelationships(containerEl: HTMLElement): void {
	this.addHeading(containerEl, "Relationships");

	new Setting(containerEl)
		.setName("Parent property")
		.setDesc("Note property used to store the parent project link.")
		.addText((text) => {
			text
				.setPlaceholder(DEFAULT_SETTINGS.relationshipPropertyNames.parent)
				.setValue(this.plugin.settings.relationshipPropertyNames.parent)
				.onChange(async (value) => {
					this.plugin.settings.relationshipPropertyNames.parent = value.trim();
					await this.plugin.saveSettings();
				});
		});

	new Setting(containerEl)
		.setName("Children property")
		.setDesc("Note property used to store child project links.")
		.addText((text) => {
			text
				.setPlaceholder(DEFAULT_SETTINGS.relationshipPropertyNames.children)
				.setValue(this.plugin.settings.relationshipPropertyNames.children)
				.onChange(async (value) => {
					this.plugin.settings.relationshipPropertyNames.children = value.trim();
					await this.plugin.saveSettings();
				});
		});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts src/settings.test.ts src/test-runner.ts
git commit -m "feat: add relationship settings"
```

## Task 2: Frontmatter List Updates

**Files:**
- Modify: `src/project-frontmatter.ts`
- Modify: `src/project-frontmatter.test.ts`

- [ ] **Step 1: Write failing frontmatter tests**

Append these tests to `src/project-frontmatter.test.ts` and update the import:

```ts
import {appendPropertyListItemInMarkdown, repairDuplicateYamlBlocks, updatePropertyInMarkdown} from "./project-frontmatter";
```

```ts
void test("appends a list property to markdown without frontmatter", () => {
	const content = "# Parent\n";

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child A]]");

	assert.equal(updated, [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"---",
		"# Parent",
		"",
	].join("\n"));
});

void test("appends to an existing YAML list property", () => {
	const content = [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child B]]");

	assert.equal(updated, [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"  - \"[[Projects/Child B]]\"",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("does not append duplicate list values", () => {
	const content = [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child A]]");

	assert.equal(updated, content);
});

void test("replaces scalar children value with a list when appending", () => {
	const content = [
		"---",
		"children: \"[[Projects/Child A]]\"",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child B]]");

	assert.equal(updated, [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"  - \"[[Projects/Child B]]\"",
		"---",
		"Body",
		"",
	].join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `appendPropertyListItemInMarkdown` is not exported.

- [ ] **Step 3: Implement list append support**

In `src/project-frontmatter.ts`, add the export after `updatePropertyInMarkdown`:

```ts
export function appendPropertyListItemInMarkdown(content: string, propertyName: string, value: string): string {
	const trimmedValue = value.trim();
	if (!propertyName.trim() || !trimmedValue) {
		return content;
	}

	const frontmatters = getTopEditableYamlGroup(content);

	if (frontmatters.length === 0) {
		const body = appendYamlListItem("", propertyName, trimmedValue);
		const documentStart = getDocumentStart(content);
		return `${content.slice(0, documentStart)}---\n${body}\n---\n${content.slice(documentStart)}`;
	}

	const firstFrontmatter = frontmatters[0]!;
	const targetFrontmatter = frontmatters[frontmatters.length - 1]!;
	const preservedOpening = content.slice(targetFrontmatter.start, targetFrontmatter.bodyStart);
	const mergedBody = mergeSimpleYamlScalars(
		frontmatters.slice(0, -1).map((frontmatter) => frontmatter.body),
		targetFrontmatter.body,
	);
	const nextBody = appendYamlListItem(mergedBody, propertyName, trimmedValue);

	return `${content.slice(0, firstFrontmatter.start)}${preservedOpening}${nextBody}${content.slice(targetFrontmatter.bodyEnd)}`;
}
```

Add these helpers near `updateYamlScalar`:

```ts
function appendYamlListItem(body: string, propertyName: string, value: string): string {
	const lines = body.length ? body.split(/\r?\n/) : [];
	const lineEnd = body.includes("\r\n") ? "\r\n" : "\n";
	const keyIndex = lines.findIndex((line) => isYamlKeyLine(line, propertyName));

	if (keyIndex === -1) {
		lines.push(...formatYamlListProperty(propertyName, [value]));
		return lines.join(lineEnd);
	}

	const replaceEnd = findYamlPropertyEnd(lines, keyIndex);
	const existingValues = readYamlPropertyValues(lines, keyIndex, replaceEnd);
	const values = appendUniqueYamlValue(existingValues, value);
	if (values.length === existingValues.length && isYamlListProperty(lines, keyIndex, replaceEnd)) {
		return body;
	}

	lines.splice(keyIndex, replaceEnd - keyIndex, ...formatYamlListProperty(propertyName, values));
	return lines.join(lineEnd);
}

function readYamlPropertyValues(lines: string[], keyIndex: number, endIndex: number): string[] {
	const values: string[] = [];
	const scalarValue = readYamlScalarValue(lines[keyIndex] ?? "");
	if (scalarValue) {
		values.push(scalarValue);
	}

	for (let index = keyIndex + 1; index < endIndex; index += 1) {
		const value = readYamlListLineValue(lines[index] ?? "");
		if (value) {
			values.push(value);
		}
	}

	return values;
}

function readYamlScalarValue(line: string): string {
	const separatorIndex = line.indexOf(":");
	if (separatorIndex === -1) {
		return "";
	}

	return unquoteYamlScalar(line.slice(separatorIndex + 1).trim());
}

function readYamlListLineValue(line: string): string {
	const match = /^[ \t]*-[ \t]*(.*)$/.exec(line);
	return match ? unquoteYamlScalar(match[1]?.trim() ?? "") : "";
}

function isYamlListProperty(lines: string[], keyIndex: number, endIndex: number): boolean {
	return endIndex > keyIndex + 1
		&& lines.slice(keyIndex + 1, endIndex).some((line) => /^[ \t]*-[ \t]*/.test(line));
}

function appendUniqueYamlValue(values: string[], value: string): string[] {
	const normalizedValue = normalizeYamlComparableValue(value);
	if (values.some((existingValue) => normalizeYamlComparableValue(existingValue) === normalizedValue)) {
		return values;
	}

	return [...values, value];
}

function normalizeYamlComparableValue(value: string): string {
	return unquoteYamlScalar(value).trim();
}

function unquoteYamlScalar(value: string): string {
	if (!value) {
		return "";
	}

	if (value.startsWith("\"") && value.endsWith("\"")) {
		try {
			return JSON.parse(value) as string;
		} catch {
			return value.slice(1, -1);
		}
	}

	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1).replace(/''/g, "'");
	}

	return value;
}

function formatYamlListProperty(propertyName: string, values: string[]): string[] {
	return [
		`${formatYamlKey(propertyName)}:`,
		...values.map((item) => `  - ${formatYamlScalar(item)}`),
	];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/project-frontmatter.ts src/project-frontmatter.test.ts
git commit -m "feat: update relationship list properties"
```

## Task 3: Relationship Parsing

**Files:**
- Create: `src/project-relationships.ts`
- Create: `src/project-relationships.test.ts`
- Modify: `src/test-runner.ts`

- [ ] **Step 1: Write failing relationship parsing tests**

Add `src/project-relationships.test.ts`:

```ts
/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {readProjectRelationships} from "./project-relationships";
import {normalizeSettings} from "./settings";

void test("reads parent and children relationship links from configured properties", () => {
	const settings = normalizeSettings();

	const relationships = readProjectRelationships(settings, {
		parent: "[[Projects/Parent project]]",
		children: ["[[Projects/Child A]]", "[[Projects/Child B|Child B]]"],
	});

	assert.equal(relationships.parent?.target, "Projects/Parent project");
	assert.equal(relationships.parent?.display, "Parent project");
	assert.deepEqual(relationships.children.map((child) => child.target), [
		"Projects/Child A",
		"Projects/Child B",
	]);
	assert.deepEqual(relationships.children.map((child) => child.display), [
		"Child A",
		"Child B",
	]);
});

void test("reads children from scalar relationship value", () => {
	const settings = normalizeSettings();

	const relationships = readProjectRelationships(settings, {
		children: "[[Projects/Only child]]",
	});

	assert.equal(relationships.parent, null);
	assert.deepEqual(relationships.children.map((child) => child.target), ["Projects/Only child"]);
});

void test("skips empty or unsupported relationship values", () => {
	const settings = normalizeSettings();

	const relationships = readProjectRelationships(settings, {
		parent: " ",
		children: ["[[Projects/Child A]]", "", 123, null],
	});

	assert.equal(relationships.parent, null);
	assert.deepEqual(relationships.children.map((child) => child.target), ["Projects/Child A"]);
});
```

Update `src/test-runner.ts`:

```ts
import "./bases/view-properties.test";
import "./bases/table-sorting.test";
import "./project-frontmatter.test";
import "./settings.test";
import "./project-relationships.test";
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `src/project-relationships.ts` does not exist.

- [ ] **Step 3: Implement pure relationship parsing**

Create `src/project-relationships.ts`:

```ts
import type {App, TFile} from "obsidian";
import type {SimpleProjectViewsSettings} from "./settings";

export interface ProjectRelationshipLink {
	raw: string;
	target: string;
	display: string;
}

export interface ProjectRelationships {
	parent: ProjectRelationshipLink | null;
	children: ProjectRelationshipLink[];
}

export function readProjectRelationships(
	settings: Pick<SimpleProjectViewsSettings, "relationshipPropertyNames">,
	frontmatter: Record<string, unknown>,
): ProjectRelationships {
	const parentPropertyName = settings.relationshipPropertyNames.parent.trim();
	const childrenPropertyName = settings.relationshipPropertyNames.children.trim();
	const parent = parentPropertyName
		? readFirstRelationshipLink(frontmatter[parentPropertyName])
		: null;
	const children = childrenPropertyName
		? readRelationshipLinks(frontmatter[childrenPropertyName])
		: [];

	return {
		parent,
		children,
	};
}

export function createProjectFileLink(app: App, sourceFile: TFile, targetFile: TFile): string {
	return app.fileManager.generateMarkdownLink(targetFile, sourceFile.path);
}

function readFirstRelationshipLink(value: unknown): ProjectRelationshipLink | null {
	return readRelationshipLinks(value)[0] ?? null;
}

function readRelationshipLinks(value: unknown): ProjectRelationshipLink[] {
	const rawValues = Array.isArray(value) ? value : [value];
	return rawValues
		.map((item) => typeof item === "string" ? parseProjectRelationshipLink(item) : null)
		.filter((item): item is ProjectRelationshipLink => item !== null);
}

function parseProjectRelationshipLink(value: string): ProjectRelationshipLink | null {
	const raw = value.trim();
	if (!raw) {
		return null;
	}

	const linkText = unwrapWikiLink(raw);
	const [targetPart, aliasPart] = splitLinkAlias(linkText);
	const target = targetPart.trim();
	if (!target) {
		return null;
	}

	return {
		raw,
		target,
		display: aliasPart?.trim() || getFallbackDisplayName(target),
	};
}

function unwrapWikiLink(value: string): string {
	return value.startsWith("[[") && value.endsWith("]]")
		? value.slice(2, -2)
		: value;
}

function splitLinkAlias(value: string): [string, string | undefined] {
	const separatorIndex = value.indexOf("|");
	if (separatorIndex === -1) {
		return [value, undefined];
	}

	return [value.slice(0, separatorIndex), value.slice(separatorIndex + 1)];
}

function getFallbackDisplayName(target: string): string {
	const withoutSubpath = target.split("#")[0] ?? target;
	const lastPathPart = withoutSubpath.split("/").filter(Boolean).pop() ?? withoutSubpath;
	return lastPathPart.replace(/\.md$/i, "") || target;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/project-relationships.ts src/project-relationships.test.ts src/test-runner.ts
git commit -m "feat: read project relationships"
```

## Task 4: Attach Relationships to Project Metadata

**Files:**
- Modify: `src/project-metadata.ts`
- Create: `src/project-metadata.typecheck.test.ts`

- [ ] **Step 1: Write the failing TypeScript usage check**

Because `ProjectInfo` is a cross-module type and there is no existing metadata test harness for Obsidian cache objects, add a type-check test and use `npm run build` as the failing check.

Create `src/project-metadata.typecheck.test.ts`:

```ts
import type {ProjectInfo} from "./project-metadata";

const __relationshipTypeCheck: ProjectInfo["relationships"] = {parent: null, children: []};
void __relationshipTypeCheck;
```

- [ ] **Step 2: Run check to verify it fails**

Run:

```bash
npm run build
```

Expected: FAIL because `ProjectInfo` has no `relationships` property.

- [ ] **Step 3: Implement metadata relationship fields and list update helper**

Remove the temporary type-check lines.

Update imports in `src/project-metadata.ts`:

```ts
import {appendPropertyListItemInMarkdown, repairDuplicateYamlBlocks, updatePropertyInMarkdown} from "./project-frontmatter";
import {readProjectRelationships} from "./project-relationships";
import type {ProjectRelationships} from "./project-relationships";
```

Add the field to `ProjectInfo`:

```ts
relationships: ProjectRelationships;
```

In `getProject`, after `icon`, read relationships:

```ts
const relationships = readProjectRelationships(settings, frontmatter);
```

Include it in the returned project:

```ts
relationships,
```

Add a vault update helper after `updateProjectProperty`:

```ts
export async function appendProjectPropertyListItem(
	app: App,
	file: TFile,
	propertyName: string,
	value: string,
): Promise<void> {
	if (!propertyName.trim() || !value.trim()) {
		return;
	}

	const content = await app.vault.read(file);
	const updatedContent = appendPropertyListItemInMarkdown(content, propertyName, value);

	if (updatedContent !== content) {
		await app.vault.modify(file, updatedContent);
	}
}
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/project-metadata.ts src/project-metadata.typecheck.test.ts
git commit -m "feat: attach relationships to project metadata"
```

## Task 5: Create Child Project Workflow

**Files:**
- Modify: `src/ui/create-project-modal.ts`
- Modify: `src/main.ts`
- Create: `src/main.typecheck.test.ts`

- [ ] **Step 1: Write the failing type-driven command check**

Create `src/main.typecheck.test.ts`:

```ts
import type SimpleProjectViewsPlugin from "./main";

type CreateChildProject = SimpleProjectViewsPlugin["createChildProject"];
const __createChildProjectTypeCheck: CreateChildProject | null = null;
void __createChildProjectTypeCheck;
```

- [ ] **Step 2: Run check to verify it fails**

Run:

```bash
npm run build
```

Expected: FAIL because `createChildProject` does not exist.

- [ ] **Step 3: Add modal customization**

In `src/ui/create-project-modal.ts`, update imports:

```ts
import {ButtonComponent, Modal, Notice, Setting, TFile} from "obsidian";
```

Add this interface before `CreateProjectModal`:

```ts
export interface CreateProjectModalOptions {
	title?: string;
	submitLabel?: string;
	errorMessage?: string;
	createProject?: (values: ProjectCreationValues) => Promise<TFile>;
}
```

Change the constructor:

```ts
constructor(
	private readonly plugin: SimpleProjectViewsPlugin,
	private readonly options: CreateProjectModalOptions = {},
) {
	super(plugin.app);
	this.values = getDefaultProjectValues(plugin);
}
```

Change the modal title:

```ts
this.setTitle(this.options.title ?? "Create project");
```

Change the create button label:

```ts
.setButtonText(this.options.submitLabel ?? "Create")
```

Change the create call and error message:

```ts
const createProject = this.options.createProject ?? ((values: ProjectCreationValues) => this.plugin.createProject(values));
await createProject(this.values);
```

```ts
new Notice(this.options.errorMessage ?? "Could not create project");
```

- [ ] **Step 4: Add create-child command and workflow**

Update imports in `src/main.ts`:

```ts
import {appendProjectPropertyListItem, ProjectIndex, repairProjectFrontmatter, updateProjectProperty} from "./project-metadata";
import {createProjectFileLink} from "./project-relationships";
```

Change `createProject` signature:

```ts
async createProject(values: ProjectCreationValues, options: {showNotice?: boolean} = {}): Promise<TFile> {
```

Change the notice line:

```ts
if (options.showNotice !== false) {
	new Notice("Project created");
}
```

Add a command after `create-project`:

```ts
this.addCommand({
	id: "create-child-project",
	name: "Create child project",
	checkCallback: (checking) => {
		const parentFile = this.getActiveMarkdownFile();
		if (!parentFile || !this.projectIndex.getProject(parentFile)) {
			return false;
		}

		if (!checking) {
			new CreateProjectModal(this, {
				title: "Create child project",
				submitLabel: "Create child",
				errorMessage: "Could not create child project",
				createProject: (values) => this.createChildProject(parentFile, values),
			}).open();
		}

		return true;
	},
});
```

Add this method before `readProjectCreationTemplate`:

```ts
async createChildProject(parentFile: TFile, values: ProjectCreationValues): Promise<TFile> {
	const childFile = await this.createProject(values, {showNotice: false});
	const parentPropertyName = this.settings.relationshipPropertyNames.parent.trim();
	const childrenPropertyName = this.settings.relationshipPropertyNames.children.trim();
	const parentLink = createProjectFileLink(this.app, childFile, parentFile);
	const childLink = createProjectFileLink(this.app, parentFile, childFile);

	if (parentPropertyName) {
		await updateProjectProperty(this.app, childFile, parentPropertyName, parentLink);
	}

	if (childrenPropertyName) {
		await appendProjectPropertyListItem(this.app, parentFile, childrenPropertyName, childLink);
	}

	new Notice("Child project created");
	this.refreshProjectSurfaces();

	return childFile;
}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/create-project-modal.ts src/main.ts src/main.typecheck.test.ts
git commit -m "feat: create child projects"
```

## Task 6: Note Bar Relationship UI

**Files:**
- Create: `src/ui/project-relationship-controls.ts`
- Create: `src/ui/project-relationship-controls.typecheck.test.ts`
- Modify: `src/ui/project-note-toolbar.ts`
- Modify: `styles.css`

- [ ] **Step 1: Write the failing type-driven toolbar check**

Create `src/ui/project-relationship-controls.typecheck.test.ts`:

```ts
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import type {renderProjectRelationships} from "./project-relationship-controls";

type RenderProjectRelationships = typeof renderProjectRelationships;
const __renderProjectRelationshipsTypeCheck: RenderProjectRelationships = (
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
) => {
	void containerEl;
	void plugin;
	void project;
};
void __renderProjectRelationshipsTypeCheck;
```

- [ ] **Step 2: Run check to verify it fails**

Run:

```bash
npm run build
```

Expected: FAIL because `src/ui/project-relationship-controls.ts` does not exist.

- [ ] **Step 3: Implement note bar relationship renderer**

Create `src/ui/project-relationship-controls.ts`:

```ts
import {parseLinktext, setIcon} from "obsidian";
import type {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import type {ProjectRelationshipLink} from "../project-relationships";

export function renderProjectRelationships(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
): void {
	const parent = resolveRelationshipFile(plugin, project, project.relationships.parent);
	const children = project.relationships.children
		.map((child) => ({
			link: child,
			file: resolveRelationshipFile(plugin, project, child),
		}))
		.filter((child): child is {link: ProjectRelationshipLink; file: TFile} => child.file !== null);
	const canCreateChild = plugin.settings.relationshipPropertyNames.parent.trim().length > 0
		&& plugin.settings.relationshipPropertyNames.children.trim().length > 0;

	if (!parent && children.length === 0 && !canCreateChild) {
		return;
	}

	const relationshipsEl = containerEl.createDiv({cls: "spv-project-relationships"});

	if (parent) {
		const rowEl = relationshipsEl.createDiv({cls: "spv-relationship-row"});
		rowEl.createSpan({cls: "spv-relationship-label", text: "Parent"});
		createRelationshipButton(rowEl, plugin, project.relationships.parent?.display ?? parent.basename, parent);
	}

	if (children.length > 0) {
		const groupEl = relationshipsEl.createDiv({cls: "spv-relationship-group"});
		groupEl.createSpan({cls: "spv-relationship-label", text: "Children"});
		const listEl = groupEl.createEl("ul", {cls: "spv-relationship-list"});
		for (const child of children) {
			const itemEl = listEl.createEl("li");
			createRelationshipButton(itemEl, plugin, child.link.display || child.file.basename, child.file);
		}
	}

	if (canCreateChild) {
		const buttonEl = relationshipsEl.createEl("button", {
			cls: "spv-create-child-project",
			attr: {
				type: "button",
				"aria-label": "Create child project",
			},
		});
		setIcon(buttonEl, "git-branch-plus");
		buttonEl.createSpan({text: "Create child"});
		buttonEl.addEventListener("click", () => {
			plugin.openCreateChildProjectModal(project.file);
		});
	}
}

function createRelationshipButton(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	label: string,
	file: TFile,
): void {
	const buttonEl = containerEl.createEl("button", {
		cls: "spv-link-button spv-relationship-link",
		text: label,
		attr: {
			type: "button",
		},
	});
	buttonEl.addEventListener("click", () => {
		void plugin.app.workspace.getLeaf(false).openFile(file);
	});
}

function resolveRelationshipFile(
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	link: ProjectRelationshipLink | null,
) {
	if (!link) {
		return null;
	}

	const parsed = parseLinktext(link.target);
	return plugin.app.metadataCache.getFirstLinkpathDest(parsed.path, project.file.path);
}
```

In `src/main.ts`, make the modal opening reusable by adding this method after `refreshProjectSurfaces()`:

```ts
openCreateChildProjectModal(parentFile: TFile): void {
	if (!this.projectIndex.getProject(parentFile)) {
		new Notice("Open a project note to create a child project");
		return;
	}

	new CreateProjectModal(this, {
		title: "Create child project",
		submitLabel: "Create child",
		errorMessage: "Could not create child project",
		createProject: (values) => this.createChildProject(parentFile, values),
	}).open();
}
```

Update the command from Task 5 to call this method:

```ts
if (!checking) {
	this.openCreateChildProjectModal(parentFile);
}
```

Keep the real import and call in `src/ui/project-note-toolbar.ts`:

```ts
import {renderProjectRelationships} from "./project-relationship-controls";
```

```ts
renderProjectRelationships(toolbarEl, this.plugin, project);
```

Add CSS near the note bar/project controls styles in `styles.css`:

```css
.spv-project-relationships {
	border-top: var(--border-width, 1px) solid var(--background-modifier-border);
	display: grid;
	gap: var(--size-2-2);
	margin-top: var(--size-2-3);
	padding-top: var(--size-2-3);
}

.spv-relationship-row,
.spv-relationship-group {
	display: grid;
	gap: var(--size-2-1);
	min-width: 0;
}

.spv-relationship-label {
	color: var(--text-faint);
	font-size: var(--font-ui-smaller);
	line-height: var(--line-height-tight);
}

.spv-relationship-list {
	display: grid;
	gap: var(--size-2-1);
	list-style: none;
	margin: 0;
	padding: 0;
}

.spv-relationship-link {
	max-width: 100%;
}

button.spv-create-child-project {
	align-items: center;
	display: inline-flex;
	gap: var(--size-2-1);
	justify-content: flex-start;
	width: fit-content;
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/project-relationship-controls.ts src/ui/project-relationship-controls.typecheck.test.ts src/ui/project-note-toolbar.ts src/main.ts styles.css
git commit -m "feat: show project relationships on note bar"
```

## Task 7: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS with all node:test suites passing.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with TypeScript and esbuild completing successfully.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short
```

Expected: no unstaged changes, or only intentional uncommitted changes if final polishing is still in progress.

- [ ] **Step 4: Manual Obsidian smoke test**

In a vault with the built plugin:

1. Open an existing project note with no relationship properties.
2. Confirm the note bar shows project controls and the create-child button.
3. Select **Create child**.
4. Enter `Child relationship smoke test`.
5. Confirm the child note opens.
6. Confirm the child note has `parent: "[[...parent note...]]"`.
7. Reopen the parent note.
8. Confirm the parent note has a `children` list containing the child link.
9. Confirm the note bar shows the child link.
10. Select the child link and confirm it opens the child note.

- [ ] **Step 5: Commit any final polish**

```bash
git add src styles.css
git commit -m "chore: polish project relationships"
```

Only run this commit if Step 4 produced intentional code or style changes.
