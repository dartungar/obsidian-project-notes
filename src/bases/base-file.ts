import {PROJECT_BOARD_BASES_VIEW_TYPE, PROJECT_LIST_BASES_VIEW_TYPE, PROJECT_TABLE_BASES_VIEW_TYPE} from "../constants";
import type {SimpleProjectViewsSettings} from "../settings";

export function buildProjectBaseContent(settings: SimpleProjectViewsSettings): string {
	const filters = buildGlobalFilters(settings);
	const properties = buildProperties(settings);
	const tableOrder = buildTableOrder(settings);

	return [
		"filters:",
		...indent(filters),
		"properties:",
		...indent(properties),
		"views:",
		`  - type: ${PROJECT_LIST_BASES_VIEW_TYPE}`,
		"    name: Projects",
		`  - type: ${PROJECT_TABLE_BASES_VIEW_TYPE}`,
		"    name: Project table",
		`  - type: ${PROJECT_BOARD_BASES_VIEW_TYPE}`,
		"    name: Project board",
		"  - type: table",
		"    name: Native table",
		"    order:",
		...tableOrder.map((property) => `      - ${property}`),
		"",
	].join("\n");
}

function buildGlobalFilters(settings: SimpleProjectViewsSettings): string[] {
	const criteriaFilters: string[] = [];

	if (settings.projectTag.trim()) {
		criteriaFilters.push(`file.hasTag(${expressionString(settings.projectTag.replace(/^#/, ""))})`);
	}

	if (settings.projectPropertyName.trim()) {
		if (settings.projectPropertyValue.trim()) {
			criteriaFilters.push(`${propertyRef(settings.projectPropertyName)} == ${expressionString(settings.projectPropertyValue)}`);
		} else {
			criteriaFilters.push(propertyRef(settings.projectPropertyName));
		}
	}

	if (settings.projectFolder.trim()) {
		criteriaFilters.push(`file.inFolder(${expressionString(settings.projectFolder)})`);
	}

	if (criteriaFilters.length === 0) {
		return ["and:", "  - 'file.ext == \"md\"'"];
	}

	if (settings.criteriaMode === "all" || criteriaFilters.length === 1) {
		return [
			"and:",
			"  - 'file.ext == \"md\"'",
			...criteriaFilters.map((filter) => `  - ${yamlQuote(filter)}`),
		];
	}

	return [
		"and:",
		"  - 'file.ext == \"md\"'",
		"  - or:",
		...criteriaFilters.map((filter) => `    - ${yamlQuote(filter)}`),
	];
}

function buildProperties(settings: SimpleProjectViewsSettings): string[] {
	const properties = propertyDisplay(settings.propertyNames.status, "Status");
	if (settings.enabledProperties.icon) {
		properties.push(...propertyDisplay(settings.propertyNames.icon, "Icon"));
	}

	for (const property of settings.projectProperties) {
		properties.push(...propertyDisplay(property.name, property.label));
	}

	return properties;
}

function buildTableOrder(settings: SimpleProjectViewsSettings): string[] {
	return [
		"file.name",
		...(settings.enabledProperties.icon && settings.propertyNames.icon.trim() ? [propertyRef(settings.propertyNames.icon)] : []),
		...(settings.propertyNames.status.trim() ? [propertyRef(settings.propertyNames.status)] : []),
		...settings.projectProperties
			.filter((property) => property.name.trim().length > 0)
			.map((property) => propertyRef(property.name)),
	];
}

function propertyDisplay(propertyName: string, displayName: string): string[] {
	if (!propertyName.trim()) {
		return [];
	}

	return [
		`${yamlKey(propertyName)}:`,
		`  displayName: ${yamlQuote(displayName)}`,
	];
}

function propertyRef(propertyName: string): string {
	if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(propertyName)) {
		return propertyName;
	}

	return `note[${expressionString(propertyName)}]`;
}

function expressionString(value: string): string {
	return JSON.stringify(value);
}

function yamlKey(value: string): string {
	if (/^[A-Za-z0-9_.-]+$/.test(value)) {
		return value;
	}

	return yamlQuote(value);
}

function yamlQuote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

function indent(lines: string[]): string[] {
	return lines.map((line) => `  ${line}`);
}
