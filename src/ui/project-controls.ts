import {App, setIcon, setTooltip} from "obsidian";
import {
	formatProjectPropertyValue,
	getProjectPropertyById,
	getProjectPropertyDefinitionById,
	getProjectPropertyProgressPercent,
	isNumericProperty,
	isProjectPropertyEmpty,
	normalizePropertyInputValue,
	sanitizePropertyCssClass,
} from "../project-properties";
import type {ProjectPropertyDefinition, ProjectPropertyInputValue, ProjectPropertyValue} from "../project-properties";
import {updateProjectProperty} from "../project-metadata";
import type {ProjectInfo} from "../project-metadata";
import {getStatusColor} from "../settings";
import type {SimpleProjectViewsSettings} from "../settings";
import {ProjectIconSuggestModal} from "./icon-suggest-modal";

export type ProjectControlField = string;

export interface ProjectControlsOptions {
	compact?: boolean;
	fields?: ProjectControlField[];
	controlClass?: string;
	focusField?: ProjectControlField;
	labels?: Partial<Record<ProjectControlField, string>>;
	readOnly?: boolean;
	readOnlyProgress?: boolean;
	afterUpdate?: () => void;
}

type FocusableControl = HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function renderProjectControls(
	containerEl: HTMLElement,
	app: App,
	settings: SimpleProjectViewsSettings,
	project: ProjectInfo,
	options: ProjectControlsOptions = {},
): void {
	const fields = options.fields ?? getDefaultControlFields(settings);
	if (fields.length === 0) {
		return;
	}

	if (options.readOnly) {
		renderProjectSummary(containerEl, settings, project, fields, options);
		return;
	}

	const classes = [
		"spv-project-controls",
		options.compact ? "spv-project-controls-compact" : "",
		options.controlClass ?? "",
	]
		.filter((className) => className.length > 0)
		.join(" ");
	const controlsEl = containerEl.createDiv({
		cls: classes,
	});
	let focusEl: FocusableControl | null = null;

	for (const field of fields) {
		if (field === "status") {
			const inputEl = createSelectField(controlsEl, options.labels?.status ?? "Status", "status", settings.statusOptions, project.status, async (value) => {
				await updateProjectProperty(app, project.file, settings.propertyNames.status, value || null);
				options.afterUpdate?.();
			});
			inputEl.parentElement?.style.setProperty("--spv-status-color", getStatusColor(settings, project.status));
			if (options.focusField === "status") {
				focusEl = inputEl;
			}
			continue;
		}

		if (field === "icon") {
			if (!settings.enabledProperties.icon || !settings.propertyNames.icon.trim()) {
				continue;
			}

			const inputEl = createIconField(controlsEl, app, project.icon, "Project icon", "icon", async (value) => {
				await updateProjectProperty(app, project.file, settings.propertyNames.icon, value);
				options.afterUpdate?.();
			});
			if (options.focusField === "icon") {
				focusEl = inputEl;
			}
			continue;
		}

		const definition = getProjectPropertyDefinitionById(settings.projectProperties, field);
		if (!definition || !definition.name.trim()) {
			continue;
		}

		const property = getProjectPropertyById(project.properties, definition.id) ?? {
			definition,
			raw: null,
			value: "",
			numberValue: null,
		};

		if (options.readOnlyProgress && definition.render === "progress") {
			renderProjectPropertyDisplay(controlsEl, property, options.labels?.[field]);
			continue;
		}

		const inputEl = createPropertyField(controlsEl, property, options.labels?.[field], async (value) => {
			await updateProjectProperty(app, project.file, definition.name, normalizePropertyInputValue(definition, value));
			options.afterUpdate?.();
		});

		if (options.focusField === field) {
			focusEl = inputEl;
		}
	}

	if (focusEl) {
		focusControl(focusEl);
	}
}

export function getDefaultControlFields(settings: SimpleProjectViewsSettings): ProjectControlField[] {
	return [
		...(settings.enabledProperties.icon ? ["icon"] : []),
		"status",
		...settings.projectProperties.map((property) => property.id),
	];
}

export function getNonEmptyProjectPropertyFieldIds(project: ProjectInfo): ProjectControlField[] {
	return project.properties
		.filter((property) => !isProjectPropertyEmpty(property))
		.map((property) => property.definition.id);
}

function renderProjectSummary(
	containerEl: HTMLElement,
	settings: SimpleProjectViewsSettings,
	project: ProjectInfo,
	fields: ProjectControlField[],
	options: ProjectControlsOptions,
): void {
	const classes = [
		"spv-project-summary-fields",
		options.compact ? "spv-project-summary-fields-compact" : "",
		options.controlClass ?? "",
	]
		.filter(Boolean)
		.join(" ");
	const summaryEl = containerEl.createDiv({cls: classes});

	for (const field of fields) {
		if (field === "status") {
			createStatusSummaryItem(summaryEl, settings, project.status, options.labels?.status ?? "Status");
			continue;
		}

		const property = getProjectPropertyById(project.properties, field);
		if (!property || isProjectPropertyEmpty(property)) {
			continue;
		}

		createPropertySummaryItem(summaryEl, property, options.labels?.[field] ?? property.definition.label);
	}

	if (summaryEl.childElementCount === 0) {
		summaryEl.remove();
	}
}

function createStatusSummaryItem(
	containerEl: HTMLElement,
	settings: SimpleProjectViewsSettings,
	status: string,
	label: string,
): void {
	const itemEl = containerEl.createDiv({cls: "spv-summary-item spv-summary-status"});
	itemEl.createSpan({cls: "spv-summary-label", text: label});
	const badgeEl = itemEl.createSpan({
		cls: "spv-status-badge",
		text: status || "No status",
	});
	badgeEl.style.setProperty("--spv-status-color", getStatusColor(settings, status));
}

function createPropertySummaryItem(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
): void {
	if (property.definition.render === "progress") {
		createProgressSummaryItem(containerEl, property, label);
		return;
	}

	if (property.definition.render === "stars") {
		createStarsSummaryItem(containerEl, property, label);
		return;
	}

	createScalarSummaryItem(containerEl, property, label);
}

function createProgressSummaryItem(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
): void {
	const itemEl = containerEl.createDiv({cls: "spv-summary-item spv-summary-progress"});
	addPropertySummaryLabelClass(itemEl, property);
	itemEl.style.setProperty("--spv-progress", `${getProjectPropertyProgressPercent(property)}%`);
	createPropertySummaryLabel(itemEl, property, label);
	const trackEl = itemEl.createSpan({cls: "spv-progress-track"});
	trackEl.setAttribute("role", "progressbar");
	trackEl.setAttribute("aria-label", label);
	trackEl.setAttribute("aria-valuemin", String(property.definition.min));
	trackEl.setAttribute("aria-valuemax", String(property.definition.max));
	trackEl.setAttribute("aria-valuenow", String(property.numberValue ?? property.definition.min));
	trackEl.createSpan({cls: "spv-progress-fill"});
	itemEl.createSpan({
		cls: "spv-summary-value spv-progress-value",
		text: formatProjectPropertyValue(property),
	});
}

function createStarsSummaryItem(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
): void {
	const itemEl = containerEl.createDiv({cls: "spv-summary-item spv-summary-stars"});
	addPropertySummaryLabelClass(itemEl, property);
	createPropertySummaryLabel(itemEl, property, label);
	const starsEl = itemEl.createSpan({
		cls: "spv-summary-value spv-star-control spv-star-control-readonly",
		attr: {"aria-label": `${label}: ${formatProjectPropertyValue(property)}`},
	});

	for (const starValue of getStarValues(property.definition)) {
		const starEl = starsEl.createSpan({
			cls: `spv-star-display${property.numberValue !== null && property.numberValue >= starValue ? " is-filled" : ""}`,
			attr: {"aria-hidden": "true"},
		});
		setIcon(starEl, "star");
	}
}

function createScalarSummaryItem(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
): void {
	const isLongText = property.definition.render === "textarea";
	const itemEl = containerEl.createDiv({
		cls: `spv-summary-item${isLongText ? " spv-summary-textarea" : ""}`,
	});
	addPropertySummaryLabelClass(itemEl, property);
	createPropertySummaryLabel(itemEl, property, label);
	itemEl.createSpan({
		cls: "spv-summary-value",
		text: formatProjectPropertyValue(property),
	});
}

function createPropertySummaryLabel(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
): void {
	if (property.definition.labelMode === "icon" && property.definition.icon) {
		const labelEl = containerEl.createSpan({
			cls: "spv-summary-label spv-summary-label-icon",
			attr: {
				"aria-label": label,
				"data-tooltip": label,
				title: label,
			},
		});
		setIcon(labelEl, property.definition.icon);
		setTooltip(labelEl, label, {placement: "top"});
		return;
	}

	containerEl.createSpan({cls: "spv-summary-label", text: label});
}

function addPropertySummaryLabelClass(
	itemEl: HTMLElement,
	property: ProjectPropertyValue,
): void {
	if (property.definition.labelMode === "icon" && property.definition.icon) {
		itemEl.addClass("spv-summary-item-icon-label");
	}
}

function createPropertyField(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string | undefined,
	onChange: (value: ProjectPropertyInputValue) => Promise<void>,
): FocusableControl {
	if (property.definition.render === "progress") {
		return createProgressField(containerEl, property, label ?? property.definition.label, onChange);
	}

	if (property.definition.render === "stars") {
		return createStarsField(containerEl, property, label ?? property.definition.label, onChange);
	}

	if (property.definition.render === "textarea") {
		return createTextAreaField(containerEl, property, label ?? property.definition.label, onChange);
	}

	return createTextField(containerEl, property, label ?? property.definition.label, onChange);
}

function createIconField(
	containerEl: HTMLElement,
	app: App,
	value: string,
	label: string,
	kind: string,
	onChange: (value: ProjectPropertyInputValue) => Promise<void>,
): HTMLButtonElement {
	const trimmedValue = value.trim();
	const fieldEl = createField(containerEl, label, kind, trimmedValue.length === 0);
	const pickerEl = fieldEl.createDiv({cls: "spv-icon-picker"});
	const buttonEl = pickerEl.createEl("button", {
		cls: `spv-icon-picker-button${trimmedValue ? "" : " is-empty"}`,
		attr: {
			type: "button",
			"aria-label": trimmedValue ? `Change ${label}: ${trimmedValue}` : `Choose ${label}`,
		},
	});
	const previewEl = buttonEl.createSpan({cls: "spv-project-icon spv-icon-picker-preview", attr: {"aria-hidden": "true"}});
	setIcon(previewEl, trimmedValue || "image");
	buttonEl.createSpan({
		cls: "spv-icon-picker-label",
		text: trimmedValue || "Choose icon",
	});
	buttonEl.addEventListener("click", () => {
		new ProjectIconSuggestModal(app, trimmedValue, async (icon) => {
			await onChange(icon);
		}).open();
	});

	if (trimmedValue) {
		const clearButtonEl = pickerEl.createEl("button", {
			cls: "clickable-icon spv-icon-picker-clear",
			attr: {
				type: "button",
				"aria-label": `Clear ${label}`,
			},
		});
		setIcon(clearButtonEl, "x");
		clearButtonEl.addEventListener("click", () => {
			void onChange(null);
		});
	}

	return buttonEl;
}

function createSelectField(
	containerEl: HTMLElement,
	label: string,
	kind: string,
	options: string[],
	value: string,
	onChange: (value: string) => Promise<void>,
): HTMLSelectElement {
	const fieldEl = createField(containerEl, label, kind, value.length === 0);
	const selectEl = fieldEl.createEl("select");
	const normalizedOptions = ensureOption(options, value);

	const unsetOptionEl = selectEl.createEl("option", {text: "Unset"});
	unsetOptionEl.value = "";
	for (const option of normalizedOptions) {
		const optionEl = selectEl.createEl("option", {text: option});
		optionEl.value = option;
	}

	selectEl.value = value;
	selectEl.addEventListener("change", () => {
		void onChange(selectEl.value);
	});

	return selectEl;
}

function createProgressField(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
	onChange: (value: ProjectPropertyInputValue) => Promise<void>,
): HTMLInputElement {
	const definition = property.definition;
	const value = property.numberValue ?? definition.min;
	const fieldEl = createField(containerEl, label, definition, property.numberValue === null);
	updateProgressStyle(fieldEl, property);

	const inputEl = fieldEl.createEl("input");
	inputEl.type = "range";
	inputEl.min = String(definition.min);
	inputEl.max = String(definition.max);
	inputEl.step = String(definition.step);
	inputEl.value = String(value);
	inputEl.setAttribute("aria-label", label);

	const valueEl = fieldEl.createSpan({
		cls: "spv-progress-value",
		text: formatProgressValue(property, value),
	});

	inputEl.addEventListener("input", () => {
		const nextValue = Number.parseFloat(inputEl.value);
		fieldEl.classList.remove("spv-control-empty");
		updateProgressStyle(fieldEl, {...property, numberValue: nextValue});
		valueEl.setText(formatProgressValue(property, nextValue));
	});

	inputEl.addEventListener("change", () => {
		void onChange(Number.parseFloat(inputEl.value));
	});

	return inputEl;
}

function createStarsField(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
	onChange: (value: ProjectPropertyInputValue) => Promise<void>,
): HTMLButtonElement {
	const fieldEl = createField(containerEl, label, property.definition, property.numberValue === null);
	const starsEl = fieldEl.createDiv({cls: "spv-star-control"});
	let firstButtonEl: HTMLButtonElement | null = null;

	for (const starValue of getStarValues(property.definition)) {
		const starButtonEl = starsEl.createEl("button", {
			cls: `clickable-icon spv-star-button${property.numberValue !== null && property.numberValue >= starValue ? " is-filled" : ""}`,
			attr: {
				type: "button",
				"aria-label": `${label}: ${starValue}`,
			},
		});
		setIcon(starButtonEl, "star");
		starButtonEl.addEventListener("click", () => {
			void onChange(starValue);
		});

		firstButtonEl ??= starButtonEl;
	}

	const clearButtonEl = starsEl.createEl("button", {
		cls: "clickable-icon spv-star-clear",
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

function createTextAreaField(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
	onChange: (value: ProjectPropertyInputValue) => Promise<void>,
): HTMLTextAreaElement {
	const fieldEl = createField(containerEl, label, property.definition, property.value.length === 0);
	const inputEl = fieldEl.createEl("textarea");
	inputEl.value = property.value;
	inputEl.rows = 3;
	inputEl.addEventListener("change", () => {
		void onChange(inputEl.value);
	});

	return inputEl;
}

function createTextField(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label: string,
	onChange: (value: ProjectPropertyInputValue) => Promise<void>,
): HTMLInputElement {
	const fieldEl = createField(containerEl, label, property.definition, property.value.length === 0);
	const inputEl = fieldEl.createEl("input");
	inputEl.type = getInputType(property.definition);
	inputEl.value = getInputValue(property);
	inputEl.setAttribute("aria-label", label);
	inputEl.addEventListener("change", () => {
		void onChange(inputEl.value);
	});

	return inputEl;
}

export function renderProjectPropertyDisplay(
	containerEl: HTMLElement,
	property: ProjectPropertyValue,
	label = property.definition.label,
): void {
	if (property.definition.render === "progress") {
		createProgressDisplay(containerEl, property, label);
		return;
	}

	if (property.definition.render === "stars") {
		createStarsDisplay(containerEl, property, label);
		return;
	}

	createScalarDisplay(containerEl, property, label);
}

function createProgressDisplay(containerEl: HTMLElement, property: ProjectPropertyValue, label: string): void {
	const fieldEl = createField(containerEl, label, property.definition, property.numberValue === null);
	fieldEl.addClass("spv-control-progress-readonly");
	updateProgressStyle(fieldEl, property);

	const trackEl = fieldEl.createSpan({cls: "spv-progress-track"});
	trackEl.setAttribute("role", "progressbar");
	trackEl.setAttribute("aria-label", label);
	trackEl.setAttribute("aria-valuemin", String(property.definition.min));
	trackEl.setAttribute("aria-valuemax", String(property.definition.max));
	trackEl.setAttribute("aria-valuenow", String(property.numberValue ?? property.definition.min));
	trackEl.createSpan({cls: "spv-progress-fill"});

	fieldEl.createSpan({
		cls: "spv-progress-value",
		text: formatProjectPropertyValue(property) || formatProgressValue(property, property.definition.min),
	});
}

function createStarsDisplay(containerEl: HTMLElement, property: ProjectPropertyValue, label: string): void {
	const fieldEl = createField(containerEl, label, property.definition, property.numberValue === null);
	const starsEl = fieldEl.createDiv({cls: "spv-star-control spv-star-control-readonly"});

	for (const starValue of getStarValues(property.definition)) {
		const starEl = starsEl.createSpan({
			cls: `spv-star-display${property.numberValue !== null && property.numberValue >= starValue ? " is-filled" : ""}`,
			attr: {"aria-hidden": "true"},
		});
		setIcon(starEl, "star");
	}

	starsEl.createSpan({
		cls: "spv-star-value",
		text: property.numberValue === null ? "Unset" : formatProjectPropertyValue(property),
	});
}

function createScalarDisplay(containerEl: HTMLElement, property: ProjectPropertyValue, label: string): void {
	const fieldEl = createField(containerEl, label, property.definition, property.value.length === 0);
	fieldEl.createSpan({
		cls: "spv-readonly-value",
		text: formatProjectPropertyValue(property) || "Unset",
	});
}

function createField(
	containerEl: HTMLElement,
	label: string,
	propertyOrKind: ProjectPropertyDefinition | string,
	isEmpty: boolean,
): HTMLElement {
	const kind = typeof propertyOrKind === "string"
		? propertyOrKind
		: propertyOrKind.render;
	const idClass = typeof propertyOrKind === "string"
		? ""
		: ` spv-control-property spv-control-property-${sanitizePropertyCssClass(propertyOrKind.id)}`;
	const fieldEl = containerEl.createDiv({
		cls: `spv-control-field spv-control-${sanitizePropertyCssClass(kind)}${idClass}${isEmpty ? " spv-control-empty" : ""}`,
	});
	fieldEl.createEl("label", {text: label});
	return fieldEl;
}

function updateProgressStyle(fieldEl: HTMLElement, property: ProjectPropertyValue): void {
	fieldEl.style.setProperty("--spv-progress", `${getProjectPropertyProgressPercent(property)}%`);
}

function formatProgressValue(property: ProjectPropertyValue, value: number): string {
	if (property.definition.min === 0 && property.definition.max === 100) {
		return `${formatCompactNumber(value)}%`;
	}

	return formatCompactNumber(value);
}

function getInputType(definition: ProjectPropertyDefinition): string {
	if (definition.render === "date") {
		return "date";
	}

	if (definition.render === "datetime") {
		return "datetime-local";
	}

	if (isNumericProperty(definition)) {
		return "number";
	}

	return "text";
}

function getInputValue(property: ProjectPropertyValue): string {
	if (property.definition.render === "datetime") {
		return property.value.replace(/Z$/, "");
	}

	return property.value;
}

function getStarValues(definition: ProjectPropertyDefinition): number[] {
	const min = Math.max(1, Math.ceil(definition.min));
	const max = Math.max(min, Math.floor(definition.max));
	const values: number[] = [];

	for (let value = min; value <= max; value += 1) {
		values.push(value);
	}

	return values.slice(0, 12);
}

function ensureOption(options: string[], value: string): string[] {
	if (!value || options.includes(value)) {
		return options;
	}

	return [value, ...options];
}

function focusControl(inputEl: FocusableControl): void {
	requestAnimationFrame(() => {
		inputEl.focus();
		if (inputEl instanceof HTMLInputElement && inputEl.type === "text") {
			inputEl.select();
		}
	});
}

function formatCompactNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
