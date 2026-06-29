export type ProjectPropertyValueType = "text" | "number" | "date" | "datetime";
export type ProjectPropertyRenderMode = "text" | "textarea" | "progress" | "stars" | "date" | "datetime";
export type ProjectPropertyLabelMode = "name" | "icon";

export interface ProjectPropertyDefinition {
	id: string;
	name: string;
	label: string;
	type: ProjectPropertyValueType;
	render: ProjectPropertyRenderMode;
	icon: string;
	labelMode: ProjectPropertyLabelMode;
	min: number;
	max: number;
	step: number;
}

export interface ProjectPropertyValue {
	definition: ProjectPropertyDefinition;
	raw: unknown;
	value: string;
	numberValue: number | null;
}

export type ProjectPropertyInputValue = string | number | null;

export const DEFAULT_PROJECT_PROPERTIES: ProjectPropertyDefinition[] = [
	{
		id: "progress",
		name: "progress",
		label: "Progress",
		type: "number",
		render: "progress",
		icon: "chart-no-axes-column-increasing",
		labelMode: "name",
		min: 0,
		max: 100,
		step: 5,
	},
	{
		id: "due",
		name: "due",
		label: "Due",
		type: "date",
		render: "date",
		icon: "calendar-days",
		labelMode: "name",
		min: 0,
		max: 100,
		step: 5,
	},
];

export const LEGACY_PROJECT_PROPERTIES: ProjectPropertyDefinition[] = [
	...DEFAULT_PROJECT_PROPERTIES,
	{
		id: "delegatedTo",
		name: "delegated_to",
		label: "Delegated",
		type: "text",
		render: "text",
		icon: "user-round",
		labelMode: "name",
		min: 0,
		max: 100,
		step: 5,
	},
	{
		id: "followUp",
		name: "follow_up",
		label: "Follow up",
		type: "date",
		render: "date",
		icon: "calendar-check",
		labelMode: "name",
		min: 0,
		max: 100,
		step: 5,
	},
	{
		id: "nextAction",
		name: "next_action",
		label: "Next action",
		type: "text",
		render: "text",
		icon: "list-plus",
		labelMode: "name",
		min: 0,
		max: 100,
		step: 5,
	},
	{
		id: "blockedReason",
		name: "blocked_reason",
		label: "Blocked reason",
		type: "text",
		render: "textarea",
		icon: "octagon-alert",
		labelMode: "name",
		min: 0,
		max: 100,
		step: 5,
	},
];

const PROPERTY_TYPES: ProjectPropertyValueType[] = ["text", "number", "date", "datetime"];
const PROPERTY_RENDER_MODES: ProjectPropertyRenderMode[] = ["text", "textarea", "progress", "stars", "date", "datetime"];
const PROPERTY_LABEL_MODES: ProjectPropertyLabelMode[] = ["name", "icon"];

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 5;
const DEFAULT_STAR_MAX = 5;

export function getPropertyTypeLabel(type: ProjectPropertyValueType): string {
	switch (type) {
		case "number":
			return "Number";
		case "date":
			return "Date";
		case "datetime":
			return "Date/time";
		case "text":
			return "Text";
	}
}

export function getPropertyRenderModeLabel(render: ProjectPropertyRenderMode): string {
	switch (render) {
		case "textarea":
			return "Text area";
		case "progress":
			return "Progress bar";
		case "stars":
			return "Stars";
		case "date":
			return "Date";
		case "datetime":
			return "Date/time";
		case "text":
			return "Text field";
	}
}

export function getPropertyLabelModeLabel(mode: ProjectPropertyLabelMode): string {
	switch (mode) {
		case "icon":
			return "Icon";
		case "name":
			return "Name";
	}
}

export function getCompatibleRenderModes(type: ProjectPropertyValueType): ProjectPropertyRenderMode[] {
	switch (type) {
		case "number":
			return ["progress", "stars", "text"];
		case "date":
			return ["date", "text"];
		case "datetime":
			return ["datetime", "text"];
		case "text":
			return ["text", "textarea"];
	}
}

export function normalizeProjectPropertyDefinition(
	value: unknown,
	usedIds: Set<string>,
	fallbackIndex: number,
): ProjectPropertyDefinition | null {
	if (!isRecord(value)) {
		return null;
	}

	if (isLegacyIconProperty(value)) {
		return null;
	}

	const type = normalizePropertyType(value.type);
	const render = normalizePropertyRenderMode(type, value.render);
	const fallbackId = `property-${fallbackIndex + 1}`;
	const id = makeUniquePropertyId(readString(value.id) || readString(value.name) || fallbackId, usedIds);
	const label = readString(value.label) || readString(value.name) || "Property";
	const name = readString(value.name);
	const icon = readString(value.icon);
	const labelMode = normalizePropertyLabelMode(value.labelMode);
	const defaultMax = render === "stars" ? DEFAULT_STAR_MAX : DEFAULT_MAX;
	const min = normalizeNumber(value.min, DEFAULT_MIN);
	const max = Math.max(min, normalizeNumber(value.max, defaultMax));
	const step = Math.max(1, normalizeNumber(value.step, render === "stars" ? 1 : DEFAULT_STEP));

	return {
		id,
		name,
		label,
		type,
		render,
		icon,
		labelMode,
		min,
		max,
		step,
	};
}

export function normalizeProjectPropertyDefinitions(value: unknown): ProjectPropertyDefinition[] {
	if (!Array.isArray(value)) {
		return cloneProjectProperties(DEFAULT_PROJECT_PROPERTIES);
	}

	const usedIds = new Set<string>(["status", "icon"]);
	const definitions = value
		.map((item, index) => normalizeProjectPropertyDefinition(item, usedIds, index))
		.filter((definition): definition is ProjectPropertyDefinition => definition !== null);

	return definitions;
}

export function cloneProjectProperties(properties: ProjectPropertyDefinition[]): ProjectPropertyDefinition[] {
	return properties.map((property) => ({...property}));
}

export function createProjectPropertyDefinition(
	existingProperties: ProjectPropertyDefinition[],
	label = "New property",
): ProjectPropertyDefinition {
	const usedIds = new Set(["status", "icon", ...existingProperties.map((property) => property.id)]);
	const index = existingProperties.length + 1;
	const id = makeUniquePropertyId(label, usedIds);
	const suffix = index > 1 ? String(index) : "";

	return {
		id,
		name: `property${suffix}`,
		label,
		type: "text",
		render: "text",
		icon: "",
		labelMode: "name",
		min: DEFAULT_MIN,
		max: DEFAULT_MAX,
		step: DEFAULT_STEP,
	};
}

export function normalizePropertyType(value: unknown): ProjectPropertyValueType {
	return typeof value === "string" && PROPERTY_TYPES.includes(value as ProjectPropertyValueType)
		? value as ProjectPropertyValueType
		: "text";
}

export function normalizePropertyRenderMode(
	type: ProjectPropertyValueType,
	value: unknown,
): ProjectPropertyRenderMode {
	const compatibleModes = getCompatibleRenderModes(type);
	if (typeof value === "string" && PROPERTY_RENDER_MODES.includes(value as ProjectPropertyRenderMode)) {
		const render = value as ProjectPropertyRenderMode;
		if (compatibleModes.includes(render)) {
			return render;
		}
	}

	return compatibleModes[0] ?? "text";
}

export function normalizePropertyLabelMode(value: unknown): ProjectPropertyLabelMode {
	return typeof value === "string" && PROPERTY_LABEL_MODES.includes(value as ProjectPropertyLabelMode)
		? value as ProjectPropertyLabelMode
		: "name";
}

export function readProjectPropertyValue(
	definition: ProjectPropertyDefinition,
	raw: unknown,
): ProjectPropertyValue {
	const numberValue = readNumber(raw);
	const value = numberValue !== null && isNumericProperty(definition)
		? formatNumber(numberValue)
		: readScalarString(raw);

	return {
		definition,
		raw,
		value,
		numberValue: numberValue === null ? null : clampNumber(numberValue, definition.min, definition.max),
	};
}

export function isProjectPropertyEmpty(property: ProjectPropertyValue): boolean {
	if (isNumericProperty(property.definition)) {
		return property.numberValue === null;
	}

	return property.value.trim().length === 0;
}

export function isNumericProperty(definition: ProjectPropertyDefinition): boolean {
	return definition.type === "number" || definition.render === "progress" || definition.render === "stars";
}

export function formatProjectPropertyValue(property: ProjectPropertyValue): string {
	if (isNumericProperty(property.definition)) {
		if (property.numberValue === null) {
			return "";
		}

		if (property.definition.render === "progress" && property.definition.min === 0 && property.definition.max === 100) {
			return `${formatNumber(property.numberValue)}%`;
		}

		return formatNumber(property.numberValue);
	}

	return property.value;
}

export function getProjectPropertyProgressPercent(property: ProjectPropertyValue): number {
	const value = property.numberValue ?? property.definition.min;
	const range = property.definition.max - property.definition.min;
	if (range <= 0) {
		return 0;
	}

	return clampNumber(((value - property.definition.min) / range) * 100, 0, 100);
}

export function getProjectPropertyById(
	properties: ProjectPropertyValue[],
	id: string,
): ProjectPropertyValue | null {
	return properties.find((property) => property.definition.id === id) ?? null;
}

export function getProjectPropertyDefinitionById(
	properties: ProjectPropertyDefinition[],
	id: string,
): ProjectPropertyDefinition | null {
	return properties.find((property) => property.id === id) ?? null;
}

export function normalizePropertyInputValue(
	definition: ProjectPropertyDefinition,
	value: string | number | null,
): ProjectPropertyInputValue {
	if (value === null) {
		return null;
	}

	if (isNumericProperty(definition)) {
		const numberValue = typeof value === "number" ? value : Number.parseFloat(value);
		if (!Number.isFinite(numberValue)) {
			return null;
		}

		return clampNumber(numberValue, definition.min, definition.max);
	}

	const stringValue = String(value);
	return stringValue.trim().length === 0 ? null : stringValue;
}

export function sanitizePropertyCssClass(value: string): string {
	const sanitized = value
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();

	return sanitized || "property";
}

export function getPropertyTokenName(value: string): string {
	const token = value
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

	return token;
}

export function getPropertyTypes(): ProjectPropertyValueType[] {
	return [...PROPERTY_TYPES];
}

export function getPropertyLabelModes(): ProjectPropertyLabelMode[] {
	return [...PROPERTY_LABEL_MODES];
}

function isLegacyIconProperty(value: Record<string, unknown>): boolean {
	return readString(value.id) === "icon"
		|| readString(value.name) === "icon"
		|| readString(value.type) === "icon"
		|| readString(value.render) === "icon";
}

function makeUniquePropertyId(value: string, usedIds: Set<string>): string {
	const baseId = getPropertyTokenName(value).replace(/_/g, "-") || "property";
	let id = baseId;
	let index = 2;

	while (usedIds.has(id)) {
		id = `${baseId}-${index}`;
		index += 1;
	}

	usedIds.add(id);
	return id;
}

function readNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === "string" && value.trim()) {
		const parsedValue = Number.parseFloat(value);
		return Number.isFinite(parsedValue) ? parsedValue : null;
	}

	return null;
}

function readScalarString(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (Array.isArray(value)) {
		return value.map((item) => readScalarString(item)).filter(Boolean).join(", ");
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}

	return "";
}

function readString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown, fallback: number): number {
	const numberValue = typeof value === "number" ? value : Number.parseFloat(String(value));

	return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
