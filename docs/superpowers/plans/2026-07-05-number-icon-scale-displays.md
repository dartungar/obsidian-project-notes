# Number Icon Scale Displays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `pips` and generic `icons` number-property render modes, backed by the same stepped icon-scale renderer as existing stars.

**Architecture:** Extend the project-property render-mode model first, then refactor the star-specific UI into shared icon-scale helpers. Keep storage unchanged: all render modes continue to read and write scalar frontmatter numbers through the existing project-property pipeline.

**Tech Stack:** TypeScript, Obsidian plugin APIs (`setIcon`), Node test runner, esbuild, npm scripts.

---

## File Structure

- Modify `src/project-properties.ts`: render-mode type, labels, compatibility, normalization defaults, and exported icon-scale helper functions.
- Modify `src/settings.ts`: settings UI range/step controls for all icon-scale render modes and the renamed **Text** option label via `getPropertyRenderModeLabel`.
- Modify `src/ui/project-controls.ts`: replace star-specific editable/readonly/summary logic with shared icon-scale rendering that resolves `star`, `circle`, or the property icon.
- Modify `styles.css`: generalize star CSS selectors so icon scales inherit the current visual treatment while existing class names stay compatible where useful.
- Create `src/project-properties.test.ts`: focused unit coverage for render-mode compatibility, normalization, icon-scale values, and glyph resolution.
- Modify `src/settings.test.ts`: cover settings normalization for icon-scale step settings.
- Modify `src/ui/pretty-project-link-renderer.test.ts`: cover readonly rendering of pips/icons through the existing lightweight test element.

## Task 1: Property Model and Pure Helpers

**Files:**
- Modify: `src/project-properties.ts`
- Create: `src/project-properties.test.ts`

- [ ] **Step 1: Write failing tests for render modes and labels**

Create `src/project-properties.test.ts` with:

```ts
/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {
	getCompatibleRenderModes,
	getIconScaleRenderIcon,
	getIconScaleValues,
	getPropertyRenderModeLabel,
	normalizeProjectPropertyDefinitions,
	normalizePropertyRenderMode,
} from "./project-properties";

void test("labels text and icon scale render modes", () => {
	assert.equal(getPropertyRenderModeLabel("text"), "Text");
	assert.equal(getPropertyRenderModeLabel("stars"), "Stars");
	assert.equal(getPropertyRenderModeLabel("pips"), "Pips");
	assert.equal(getPropertyRenderModeLabel("icons"), "Icons");
});

void test("supports icon scale render modes only for number properties", () => {
	assert.deepEqual(getCompatibleRenderModes("number"), ["progress", "stars", "pips", "icons", "text"]);
	assert.equal(normalizePropertyRenderMode("number", "pips"), "pips");
	assert.equal(normalizePropertyRenderMode("number", "icons"), "icons");
	assert.equal(normalizePropertyRenderMode("text", "pips"), "text");
	assert.equal(normalizePropertyRenderMode("date", "icons"), "date");
});

void test("normalizes icon scale defaults and preserves saved stars", () => {
	const [stars, pips, icons] = normalizeProjectPropertyDefinitions([
		{id: "rating", name: "rating", label: "Rating", type: "number", render: "stars"},
		{id: "complexity", name: "complexity", label: "Complexity", type: "number", render: "pips"},
		{id: "priority", name: "priority", label: "Priority", type: "number", render: "icons", icon: "flag", max: 4, step: 2},
	]);

	assert.equal(stars?.render, "stars");
	assert.equal(stars?.max, 5);
	assert.equal(stars?.step, 1);
	assert.equal(pips?.render, "pips");
	assert.equal(pips?.max, 5);
	assert.equal(pips?.step, 1);
	assert.equal(icons?.render, "icons");
	assert.equal(icons?.max, 4);
	assert.equal(icons?.step, 2);
});

void test("generates stepped icon scale values", () => {
	assert.deepEqual(getIconScaleValues({min: 0, max: 5, step: 1}), [1, 2, 3, 4, 5]);
	assert.deepEqual(getIconScaleValues({min: 0, max: 10, step: 2}), [2, 4, 6, 8, 10]);
	assert.deepEqual(getIconScaleValues({min: 2, max: 6, step: 2}), [2, 4, 6]);
	assert.deepEqual(getIconScaleValues({min: 1, max: 30, step: 1}).length, 12);
});

void test("resolves icon scale glyphs from render mode and property icon", () => {
	assert.equal(getIconScaleRenderIcon({render: "stars", icon: "flag"}), "star");
	assert.equal(getIconScaleRenderIcon({render: "pips", icon: "flag"}), "circle");
	assert.equal(getIconScaleRenderIcon({render: "icons", icon: "flag"}), "flag");
	assert.equal(getIconScaleRenderIcon({render: "icons", icon: ""}), "circle");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `pips`, `icons`, `getIconScaleValues`, and `getIconScaleRenderIcon` do not exist yet, and `text` still labels as `Text field`.

- [ ] **Step 3: Implement minimal model changes**

In `src/project-properties.ts`:

```ts
export type ProjectPropertyRenderMode = "text" | "textarea" | "progress" | "stars" | "pips" | "icons" | "date" | "datetime";
```

Update constants and labels:

```ts
const PROPERTY_RENDER_MODES: ProjectPropertyRenderMode[] = ["text", "textarea", "progress", "stars", "pips", "icons", "date", "datetime"];
const ICON_SCALE_RENDER_MODES = new Set<ProjectPropertyRenderMode>(["stars", "pips", "icons"]);
const DEFAULT_ICON_SCALE_MAX = 5;
const MAX_ICON_SCALE_VALUES = 12;
```

```ts
case "pips":
	return "Pips";
case "icons":
	return "Icons";
case "text":
	return "Text";
```

Update compatibility:

```ts
case "number":
	return ["progress", "stars", "pips", "icons", "text"];
```

Use icon-scale defaults:

```ts
const defaultMax = isIconScaleRenderMode(render) ? DEFAULT_ICON_SCALE_MAX : DEFAULT_MAX;
const step = Math.max(1, normalizeNumber(value.step, isIconScaleRenderMode(render) ? 1 : DEFAULT_STEP));
```

Export helpers:

```ts
export interface IconScaleDefinition {
	min: number;
	max: number;
	step: number;
}

export function isIconScaleRenderMode(render: ProjectPropertyRenderMode): boolean {
	return ICON_SCALE_RENDER_MODES.has(render);
}

export function getIconScaleValues(definition: IconScaleDefinition): number[] {
	const step = Math.max(1, definition.step);
	const start = definition.min === 0 ? definition.min + step : definition.min;
	const values: number[] = [];

	for (let value = start; value <= definition.max; value += step) {
		values.push(Number.isInteger(value) ? value : Number(value.toFixed(2)));
	}

	return values.slice(0, MAX_ICON_SCALE_VALUES);
}

export function getIconScaleRenderIcon(definition: Pick<ProjectPropertyDefinition, "render" | "icon">): string {
	if (definition.render === "stars") {
		return "star";
	}

	if (definition.render === "pips") {
		return "circle";
	}

	return definition.icon.trim() || "circle";
}
```

- [ ] **Step 4: Run tests to verify model changes pass**

Run: `npm test`

Expected: PASS for the new model tests and existing tests.

- [ ] **Step 5: Commit model changes**

Run:

```bash
git add src/project-properties.ts src/project-properties.test.ts
git commit -m "feat: add icon scale property modes"
```

## Task 2: Shared Icon-Scale Controls

**Files:**
- Modify: `src/ui/project-controls.ts`
- Modify: `src/ui/pretty-project-link-renderer.test.ts`
- Modify: `styles.css`

- [ ] **Step 1: Write failing readonly rendering test**

In `src/ui/pretty-project-link-renderer.test.ts`, add a test that constructs a project with `pips` and `icons` properties and renders a pretty link:

```ts
void test("renders icon scale fields on pretty links", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const settings = normalizeSettings({
		projectProperties: [
			makeNumberProperty("complexity", "complexity", "Complexity", "pips", "circle", 5),
			makeNumberProperty("priority", "priority", "Priority", "icons", "flag", 5),
		],
		prettyLinkFields: ["complexity", "priority"],
	});
	const project = makeProject(file);
	project.properties = settings.projectProperties.map((definition, index) => ({
		definition,
		raw: index === 0 ? 2 : 3,
		value: index === 0 ? "2" : "3",
		numberValue: index === 0 ? 2 : 3,
	}));
	const plugin = makePlugin(file, project, settings);
	const containerEl = createTestElement("div");

	const linkEl = renderPrettyProjectLink(containerEl as unknown as HTMLElement, plugin, {
		file,
		project,
		sourcePath: "Daily.md",
		linktext: "Projects/Apollo",
		label: "Apollo",
	});

	assert.equal(countByClass(linkEl as unknown as TestElement, "spv-icon-scale-display"), 10);
	assert.equal(countByClass(linkEl as unknown as TestElement, "is-filled"), 5);
	assert.deepEqual(findAttrByClass(linkEl as unknown as TestElement, "spv-icon-scale-control-readonly", "aria-label"), [
		"Complexity: 2",
		"Priority: 3",
	]);
});
```

Add helpers in the same file:

```ts
function makeNumberProperty(
	id: string,
	name: string,
	label: string,
	render: "pips" | "icons",
	icon: string,
	max: number,
) {
	return {
		id,
		name,
		label,
		type: "number" as const,
		render,
		icon,
		labelMode: "name" as const,
		min: 0,
		max,
		step: 1,
	};
}

function countByClass(element: TestElement, className: string): number {
	const ownCount = element.className.split(" ").includes(className) ? 1 : 0;
	return ownCount + element.children.reduce((count, childEl) => count + countByClass(childEl, className), 0);
}

function findAttrByClass(element: TestElement, className: string, attr: string): string[] {
	const ownValue = element.className.split(" ").includes(className) && element.attributes[attr]
		? [element.attributes[attr]]
		: [];
	return [
		...ownValue,
		...element.children.flatMap((childEl) => findAttrByClass(childEl, className, attr)),
	];
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `pips` and `icons` summary render as scalar values, not icon-scale elements.

- [ ] **Step 3: Implement shared icon-scale rendering**

In `src/ui/project-controls.ts`, import the new helpers:

```ts
getIconScaleRenderIcon,
getIconScaleValues,
isIconScaleRenderMode,
```

Replace star checks with icon-scale checks:

```ts
if (isIconScaleRenderMode(property.definition.render)) {
	createIconScaleSummaryItem(containerEl, property, label, showLabel);
	return;
}
```

```ts
if (isIconScaleRenderMode(property.definition.render)) {
	return createIconScaleField(containerEl, property, label ?? property.definition.label, onChange);
}
```

```ts
if (isIconScaleRenderMode(property.definition.render)) {
	createIconScaleDisplay(containerEl, property, label);
	return;
}
```

Rename the star helpers to icon-scale helpers and use `getIconScaleValues()` and `getIconScaleRenderIcon()`:

```ts
function createIconScaleSummaryItem(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
	showLabel: boolean,
): void {
	const itemEl = containerEl.createDiv({cls: `spv-summary-item spv-summary-icon-scale spv-summary-${sanitizePropertyCssClass(property.definition.render)}`});
	if (showLabel) {
		addPropertySummaryLabelClass(itemEl, property);
	}
	createPropertySummaryLabel(itemEl, property, label, showLabel);
	const scaleEl = itemEl.createSpan({
		cls: "spv-summary-value spv-icon-scale-control spv-icon-scale-control-readonly spv-star-control spv-star-control-readonly",
		attr: {"aria-label": `${label}: ${formatProjectPropertyValue(property)}`},
	});
	renderIconScaleDisplays(scaleEl, property);
}
```

```ts
function createIconScaleField(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
	onChange: (value: ProjectPropertyInputValue) => Promise<void>,
): HTMLButtonElement {
	const fieldEl = createField(containerEl, label, property.definition, property.numberValue === null);
	const scaleEl = fieldEl.createDiv({cls: "spv-icon-scale-control spv-star-control"});
	let firstButtonEl: HTMLButtonElement | null = null;

	for (const scaleValue of getIconScaleValues(property.definition)) {
		const buttonEl = scaleEl.createEl("button", {
			cls: `clickable-icon spv-icon-scale-button spv-star-button${isIconScaleFilled(property, scaleValue) ? " is-filled" : ""}`,
			attr: {
				type: "button",
				"aria-label": `${label}: ${scaleValue}`,
			},
		});
		setIcon(buttonEl, getIconScaleRenderIcon(property.definition));
		buttonEl.addEventListener("click", () => {
			void onChange(scaleValue);
		});
		firstButtonEl ??= buttonEl;
	}

	const clearButtonEl = scaleEl.createEl("button", {
		cls: "clickable-icon spv-icon-scale-clear spv-star-clear",
		attr: {
			type: "button",
			"aria-label": `Clear ${label}`,
		},
	});
	setIcon(clearButtonEl, "x");
	clearButtonEl.addEventListener("click", () => {
		void onChange(null);
	});

	return firstButtonEl ?? clearButtonEl;
}
```

```ts
function createIconScaleDisplay(containerEl: HTMLElement, property: ProjectPropertyValue, label: string): void {
	const fieldEl = createField(containerEl, label, property.definition, property.numberValue === null);
	const scaleEl = fieldEl.createDiv({
		cls: "spv-icon-scale-control spv-icon-scale-control-readonly spv-star-control spv-star-control-readonly",
		attr: {"aria-label": `${label}: ${property.numberValue === null ? "Unset" : formatProjectPropertyValue(property)}`},
	});
	renderIconScaleDisplays(scaleEl, property);
	scaleEl.createSpan({
		cls: "spv-icon-scale-value spv-star-value",
		text: property.numberValue === null ? "Unset" : formatProjectPropertyValue(property),
	});
}
```

```ts
function renderIconScaleDisplays(containerEl: HTMLElement, property: ProjectPropertyValue): void {
	const icon = getIconScaleRenderIcon(property.definition);
	for (const scaleValue of getIconScaleValues(property.definition)) {
		const iconEl = containerEl.createSpan({
			cls: `spv-icon-scale-display spv-star-display${isIconScaleFilled(property, scaleValue) ? " is-filled" : ""}`,
			attr: {"aria-hidden": "true"},
		});
		setIcon(iconEl, icon);
	}
}

function isIconScaleFilled(property: ProjectPropertyValue, scaleValue: number): boolean {
	return property.numberValue !== null && property.numberValue >= scaleValue;
}
```

Remove the old `createStarsSummaryItem`, `createStarsField`, `createStarsDisplay`, and `getStarValues` helpers after replacing their callers.

- [ ] **Step 4: Generalize CSS selectors**

In `styles.css`, update selectors so `.spv-icon-scale-*` classes share star styling:

```css
.spv-icon-scale-control,
.spv-star-control {
	flex-wrap: wrap;
	gap: 1px;
}

button.spv-icon-scale-button,
button.spv-icon-scale-clear,
button.spv-star-button,
button.spv-star-clear {
	color: var(--text-faint);
	height: 24px;
	padding: 0 var(--size-2-1);
	width: 24px;
}

button.spv-icon-scale-button.is-filled,
button.spv-star-button.is-filled,
.spv-icon-scale-display.is-filled,
.spv-star-display.is-filled {
	color: var(--interactive-accent);
}

button.spv-icon-scale-button.is-filled svg,
button.spv-star-button.is-filled svg,
.spv-icon-scale-display.is-filled svg,
.spv-star-display.is-filled svg {
	fill: currentColor;
}

.spv-icon-scale-display,
.spv-star-display,
.spv-project-icon,
.spv-table-sort-icon,
.spv-table-property-icon {
	align-items: center;
	color: var(--text-muted);
	display: inline-flex;
	height: 1em;
	justify-content: center;
	width: 1em;
}
```

Also add `.spv-icon-scale-display svg` to the existing SVG size selector.

- [ ] **Step 5: Run tests to verify controls pass**

Run: `npm test`

Expected: PASS for the pretty-link icon-scale rendering test and all existing tests.

- [ ] **Step 6: Commit control changes**

Run:

```bash
git add src/ui/project-controls.ts src/ui/pretty-project-link-renderer.test.ts styles.css
git commit -m "feat: render number icon scales"
```

## Task 3: Settings UI Range Controls

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/settings.test.ts`

- [ ] **Step 1: Write failing settings normalization test**

In `src/settings.test.ts`, add:

```ts
void test("keeps icon scale step settings", () => {
	const settings = normalizeSettings({
		projectProperties: [
			{
				id: "complexity",
				name: "complexity",
				label: "Complexity",
				type: "number",
				render: "pips",
				icon: "circle",
				labelMode: "name",
				min: 0,
				max: 10,
				step: 2,
			},
		],
	});

	assert.deepEqual(settings.projectProperties.map((property) => ({
		render: property.render,
		min: property.min,
		max: property.max,
		step: property.step,
	})), [
		{render: "pips", min: 0, max: 10, step: 2},
	]);
});
```

- [ ] **Step 2: Run tests to verify current behavior**

Run: `npm test`

Expected: PASS if Task 1 already normalized step correctly. This test guards the settings path before changing the UI.

- [ ] **Step 3: Update settings UI conditions**

In `src/settings.ts`, import `isIconScaleRenderMode` from `./project-properties`.

Replace:

```ts
if (property.render === "progress" || property.render === "stars") {
```

with:

```ts
if (property.render === "progress" || isIconScaleRenderMode(property.render)) {
```

Replace maximum description:

```ts
.setDesc(property.render === "stars" ? "Number of stars to show." : "Largest allowed number.")
```

with:

```ts
.setDesc(isIconScaleRenderMode(property.render) ? "Largest selectable value." : "Largest allowed number.")
```

Replace the step condition and description:

```ts
if (property.render === "progress" || isIconScaleRenderMode(property.render)) {
	new Setting(containerEl)
		.setName("Step")
		.setDesc(property.render === "progress" ? "Slider increment." : "Distance between selectable values.")
```

Keep the existing `updateProjectPropertyNumber(index, "step", value)` wiring.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit settings UI changes**

Run:

```bash
git add src/settings.ts src/settings.test.ts
git commit -m "feat: expose icon scale step settings"
```

## Task 4: Final Verification and Build

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README copy**

In `README.md`, change the properties paragraph from:

```md
Property values can render as text fields, text areas, dates, date/times, progress bars, or stars.
```

to:

```md
Property values can render as text, text areas, dates, date/times, progress bars, stars, pips, or reusable icon scales.
```

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: TypeScript check passes and esbuild produces `main.js`.

- [ ] **Step 4: Commit README or verification-only changes**

If README changed, run:

```bash
git add README.md
git commit -m "docs: document icon scale render modes"
```

- [ ] **Step 5: Report final state**

Run:

```bash
git status --short
```

Expected: clean except generated release artifact `main.js` if the build script creates it and it remains ignored.
