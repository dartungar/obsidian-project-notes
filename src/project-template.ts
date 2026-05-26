import {getPropertyTokenName, normalizePropertyInputValue} from "./project-properties";
import type {ProjectPropertyDefinition, ProjectPropertyInputValue} from "./project-properties";
import type {SimpleProjectViewsSettings} from "./settings";

export interface ProjectCreationValues {
	title: string;
	icon: string;
	status: string;
	propertyValues: Record<string, ProjectPropertyInputValue>;
}

type TokenMap = Record<string, string>;

export function buildProjectPath(settings: SimpleProjectViewsSettings, values: ProjectCreationValues): string {
	const renderedPath = renderTemplate(settings.projectCreationPathTemplate, settings, values, {
		project_properties: "",
	});
	const path = renderedPath.trim().replace(/^\/+/, "");
	return path.endsWith(".md") ? path : `${path}.md`;
}

export function buildProjectContent(settings: SimpleProjectViewsSettings, values: ProjectCreationValues): string {
	const content = renderTemplate(settings.projectCreationTemplate, settings, values, {
		project_properties: buildProjectProperties(settings, values),
	});

	return content.endsWith("\n") ? content : `${content}\n`;
}

function renderTemplate(
	template: string,
	settings: SimpleProjectViewsSettings,
	values: ProjectCreationValues,
	extraTokens: TokenMap,
): string {
	const tokens = {
		...buildTokenMap(settings, values),
		...extraTokens,
	};

	return template.replace(/\{\{\s*([A-Za-z0-9_:-]+)\s*\}\}/g, (match, token: string) => tokens[token] ?? match);
}

function buildTokenMap(settings: SimpleProjectViewsSettings, values: ProjectCreationValues): TokenMap {
	const now = new Date();
	const title = values.title.trim();
	const tokens: TokenMap = {
		title,
		safe_title: sanitizeFileName(title),
		slug: slugify(title),
		date: now.toISOString().slice(0, 10),
		time: now.toISOString(),
		icon: values.icon,
		status: values.status,
		project_tag: settings.projectTag.trim(),
		project_folder: settings.projectFolder.trim(),
		project_property_name: settings.projectPropertyName.trim(),
		project_property_value: settings.projectPropertyValue.trim(),
		status_property: settings.propertyNames.status,
		icon_property: settings.propertyNames.icon,
	};

	for (const property of settings.projectProperties) {
		const value = values.propertyValues[property.id];
		addPropertyTokens(tokens, property, value);
	}

	return tokens;
}

function buildProjectProperties(settings: SimpleProjectViewsSettings, values: ProjectCreationValues): string {
	const lines: string[] = [];
	const projectTag = settings.projectTag.trim().replace(/^#/, "");
	const projectPropertyName = settings.projectPropertyName.trim();
	const projectPropertyValue = settings.projectPropertyValue.trim() || "true";

	if (projectTag) {
		lines.push("tags:");
		lines.push(`  - ${formatYamlScalar(projectTag)}`);
	}

	if (projectPropertyName) {
		lines.push(`${formatYamlKey(projectPropertyName)}: ${formatYamlScalar(projectPropertyValue)}`);
	}

	if (settings.propertyNames.status.trim() && values.status) {
		lines.push(`${formatYamlKey(settings.propertyNames.status)}: ${formatYamlScalar(values.status)}`);
	}

	if (settings.enabledProperties.icon && settings.propertyNames.icon.trim() && values.icon) {
		lines.push(`${formatYamlKey(settings.propertyNames.icon)}: ${formatYamlScalar(values.icon)}`);
	}

	for (const property of settings.projectProperties) {
		const propertyName = property.name.trim();
		const value = normalizePropertyInputValue(property, values.propertyValues[property.id] ?? null);
		if (!propertyName || value === null || value === "") {
			continue;
		}

		lines.push(`${formatYamlKey(propertyName)}: ${formatYamlScalar(value)}`);
	}

	return lines.join("\n");
}

function addPropertyTokens(
	tokens: TokenMap,
	property: ProjectPropertyDefinition,
	value: ProjectPropertyInputValue | undefined,
): void {
	const tokenValue = value === null || value === undefined ? "" : String(value);
	const keys = unique([
		property.id,
		getPropertyTokenName(property.id),
		getPropertyTokenName(property.name),
		getPropertyTokenName(property.label),
	]);

	for (const key of keys) {
		if (!key) {
			continue;
		}

		tokens[key] = tokenValue;
		tokens[`${key}_property`] = property.name;
	}
}

function sanitizeFileName(value: string): string {
	const sanitized = value
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.trim();

	return sanitized || "Untitled project";
}

function slugify(value: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "untitled-project";
}

function unique(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const value of values) {
		if (!value || seen.has(value)) {
			continue;
		}

		seen.add(value);
		result.push(value);
	}

	return result;
}

function formatYamlKey(propertyName: string): string {
	if (/^[A-Za-z0-9_.-]+$/.test(propertyName)) {
		return propertyName;
	}

	return JSON.stringify(propertyName);
}

function formatYamlScalar(value: string | number): string {
	if (typeof value === "number") {
		return String(value);
	}

	if (canUsePlainYamlScalar(value)) {
		return value;
	}

	return JSON.stringify(value);
}

function canUsePlainYamlScalar(value: string): boolean {
	return value.trim() === value
		&& value.length > 0
		&& !/^(?:true|false|null|yes|no|on|off)$/i.test(value)
		&& !value.split("").some((character) => ":#{}[],&*?|".includes(character))
		&& !/^[-?!%@`]/.test(value)
		&& !/\s$/.test(value);
}
