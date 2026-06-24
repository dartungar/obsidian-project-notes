import {App, CachedMetadata, getAllTags, TFile} from "obsidian";
import {
	isProjectPropertyEmpty,
	readProjectPropertyValue,
} from "./project-properties";
import type {ProjectPropertyInputValue, ProjectPropertyValue} from "./project-properties";
import {repairDuplicateYamlBlocks, updatePropertyInMarkdown} from "./project-frontmatter";
import type {SimpleProjectViewsSettings} from "./settings";

export interface ProjectInfo {
	file: TFile;
	title: string;
	icon: string;
	status: string;
	properties: ProjectPropertyValue[];
}

export class ProjectIndex {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => SimpleProjectViewsSettings,
	) {
	}

	getProject(file: TFile): ProjectInfo | null {
		if (!this.matchesProjectCriteria(file)) {
			return null;
		}

		const settings = this.getSettings();
		const frontmatter = this.getFrontmatter(file);
		const status = readString(frontmatter[settings.propertyNames.status]);
		const properties = settings.projectProperties
			.filter((definition) => definition.name.trim().length > 0)
			.map((definition) => readProjectPropertyValue(definition, frontmatter[definition.name]));
		const icon = settings.enabledProperties.icon ? readString(frontmatter[settings.propertyNames.icon]) : "";

		return {
			file,
			title: file.basename,
			icon,
			status,
			properties,
		};
	}

	getProjects(): ProjectInfo[] {
		return this.app.vault
			.getMarkdownFiles()
			.map((file) => this.getProject(file))
			.filter((project): project is ProjectInfo => project !== null)
			.sort(compareProjects);
	}

	matchesProjectCriteria(file: TFile): boolean {
		const settings = this.getSettings();

		if (settings.projectMatchType === "tag") {
			return settings.projectTag.trim() ? this.fileHasTag(file, settings.projectTag) : false;
		}

		if (settings.projectMatchType === "property") {
			return settings.projectPropertyName.trim()
				? this.fileHasProperty(file, settings.projectPropertyName, settings.projectPropertyValue)
				: false;
		}

		return settings.projectFolder.trim()
			? file.path === settings.projectFolder || file.path.startsWith(`${settings.projectFolder}/`)
			: false;
	}

	private fileHasTag(file: TFile, expectedTag: string): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) {
			return false;
		}

		const normalizedExpected = normalizeTag(expectedTag);
		const tags = getAllTags(cache) ?? [];
		return tags.some((tag) => normalizeTag(tag) === normalizedExpected);
	}

	private fileHasProperty(file: TFile, propertyName: string, expectedValue: string): boolean {
		const frontmatter = this.getFrontmatter(file);
		const value = frontmatter[propertyName];

		if (expectedValue.length === 0) {
			return hasValue(value);
		}

		return valueMatches(value, expectedValue);
	}

	private getFrontmatter(file: TFile): Record<string, unknown> {
		return getFrontmatter(this.app.metadataCache.getFileCache(file));
	}
}

export async function updateProjectProperty(
	app: App,
	file: TFile,
	propertyName: string,
	value: ProjectPropertyInputValue,
): Promise<void> {
	if (!propertyName.trim()) {
		return;
	}

	const content = await app.vault.read(file);
	const updatedContent = updatePropertyInMarkdown(content, propertyName, value);

	if (updatedContent !== content) {
		await app.vault.modify(file, updatedContent);
	}
}

export async function repairProjectFrontmatter(app: App, file: TFile): Promise<boolean> {
	const content = await app.vault.read(file);
	const repairedContent = repairDuplicateYamlBlocks(content);

	if (repairedContent === content) {
		return false;
	}

	await app.vault.modify(file, repairedContent);
	return true;
}

export function getFrontmatter(cache: CachedMetadata | null): Record<string, unknown> {
	return (cache?.frontmatter ?? {}) as Record<string, unknown>;
}

function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}

function hasValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (Array.isArray(value)) {
		return value.some((item) => hasValue(item));
	}

	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return true;
	}

	if (typeof value === "symbol") {
		return (value.description ?? "").trim().length > 0;
	}

	if (typeof value === "object") {
		return Object.keys(value).length > 0;
	}

	return false;
}

function valueMatches(value: unknown, expectedValue: string): boolean {
	const normalizedExpected = expectedValue.toLowerCase();

	if (Array.isArray(value)) {
		return value.some((item) => readString(item).toLowerCase() === normalizedExpected);
	}

	return readString(value).toLowerCase() === normalizedExpected;
}

function readString(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (Array.isArray(value)) {
		return value.map((item) => readString(item)).filter(Boolean).join(", ");
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}

	return "";
}

function compareProjects(a: ProjectInfo, b: ProjectInfo): number {
	const dateComparison = compareDates(getFirstDateValue(a.properties), getFirstDateValue(b.properties));
	if (dateComparison !== 0) {
		return dateComparison;
	}

	return a.title.localeCompare(b.title);
}

function getFirstDateValue(properties: ProjectPropertyValue[]): string {
	const property = properties.find((candidate) => {
		if (isProjectPropertyEmpty(candidate)) {
			return false;
		}

		return candidate.definition.render === "date" || candidate.definition.render === "datetime";
	});

	return property?.value ?? "";
}

function compareDates(a: string, b: string): number {
	if (!a && !b) {
		return 0;
	}

	if (!a) {
		return 1;
	}

	if (!b) {
		return -1;
	}

	return a.localeCompare(b);
}
