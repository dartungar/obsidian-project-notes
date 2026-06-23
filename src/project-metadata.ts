import {App, CachedMetadata, getAllTags, TFile} from "obsidian";
import {
	isProjectPropertyEmpty,
	readProjectPropertyValue,
} from "./project-properties";
import type {ProjectPropertyInputValue, ProjectPropertyValue} from "./project-properties";
import type {SimpleProjectViewsSettings} from "./settings";

export interface ProjectInfo {
	file: TFile;
	title: string;
	icon: string;
	status: string;
	properties: ProjectPropertyValue[];
	warnings: string[];
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
			warnings: getProjectWarnings(properties),
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

function updatePropertyInMarkdown(content: string, propertyName: string, value: ProjectPropertyInputValue): string {
	const frontmatters = getFirstEditableYamlGroup(content);

	if (frontmatters.length === 0) {
		const body = updateYamlScalar("", propertyName, value);
		return body ? `---\n${body}\n---\n${content}` : content;
	}

	const firstFrontmatter = frontmatters[0]!;
	const targetFrontmatter = frontmatters[frontmatters.length - 1]!;
	const preservedOpening = content.slice(targetFrontmatter.start, targetFrontmatter.bodyStart);
	const mergedBody = mergeSimpleYamlScalars(
		frontmatters.slice(0, -1).map((frontmatter) => frontmatter.body),
		targetFrontmatter.body,
	);
	const nextBody = updateYamlScalar(mergedBody, propertyName, value);

	return `${content.slice(0, firstFrontmatter.start)}${preservedOpening}${nextBody}${content.slice(targetFrontmatter.bodyEnd)}`;
}

function repairDuplicateYamlBlocks(content: string): string {
	const frontmatters = getFirstEditableYamlGroup(content);
	if (frontmatters.length < 2) {
		return content;
	}

	const firstFrontmatter = frontmatters[0]!;
	const targetFrontmatter = frontmatters[frontmatters.length - 1]!;
	const preservedOpening = content.slice(targetFrontmatter.start, targetFrontmatter.bodyStart);
	const mergedBody = mergeSimpleYamlScalars(
		frontmatters.slice(0, -1).map((frontmatter) => frontmatter.body),
		targetFrontmatter.body,
	);

	return `${content.slice(0, firstFrontmatter.start)}${preservedOpening}${mergedBody}${content.slice(targetFrontmatter.bodyEnd)}`;
}

interface EditableYamlBlock {
	start: number;
	body: string;
	bodyStart: number;
	bodyEnd: number;
	end: number;
}

function getFirstEditableYamlGroup(content: string): EditableYamlBlock[] {
	const blocks = findEditableYamlBlocks(content);
	const firstBlock = blocks[0];
	if (!firstBlock) {
		return [];
	}

	const group = [firstBlock];
	for (let index = 1; index < blocks.length; index += 1) {
		const previousBlock = group[group.length - 1]!;
		const nextBlock = blocks[index]!;
		if (content.slice(previousBlock.end, nextBlock.start).trim().length > 0) {
			break;
		}

		group.push(nextBlock);
	}

	return group;
}

function findEditableYamlBlocks(content: string): EditableYamlBlock[] {
	const blocks: EditableYamlBlock[] = [];
	let offset = 0;

	while (offset < content.length) {
		const openMatch = /(^|\n)[ \t]*---[ \t]*(?:\r?\n)/.exec(content.slice(offset));
		if (!openMatch) {
			break;
		}

		const leadingNewlineLength = openMatch[1]?.length ?? 0;
		const start = offset + openMatch.index + leadingNewlineLength;
		const openText = openMatch[0].slice(leadingNewlineLength);
		const bodyStart = start + openText.length;
		const closePattern = /\r?\n[ \t]*---[ \t]*(?=\r?\n|$)/g;
		closePattern.lastIndex = bodyStart;
		const closeMatch = closePattern.exec(content);
		if (!closeMatch) {
			break;
		}

		const bodyEnd = closeMatch.index;
		const body = content.slice(bodyStart, bodyEnd);
		let end = closeMatch.index + closeMatch[0].length;
		if (content.slice(end, end + 2) === "\r\n") {
			end += 2;
		} else if (content[end] === "\n") {
			end += 1;
		}

		if (looksLikeYamlProperties(body)) {
			blocks.push({
				start,
				body,
				bodyStart,
				bodyEnd,
				end,
			});
		}

		offset = end;
	}

	return blocks;
}

function looksLikeYamlProperties(body: string): boolean {
	return body.split(/\r?\n/).some((line) => {
		const key = getYamlLineKey(line);
		return key.length > 0 && isYamlKeyLine(line, key);
	});
}

function mergeSimpleYamlScalars(sourceBodies: string[], targetBody: string): string {
	let mergedBody = targetBody;

	for (const sourceBody of sourceBodies) {
		const sourceLines = sourceBody.split(/\r?\n/);
		for (let index = 0; index < sourceLines.length; index += 1) {
			const line = sourceLines[index] ?? "";
			const key = getYamlLineKey(line);
			if (!key || !isYamlKeyLine(line, key) || isYamlPropertyNested(sourceLines, index)) {
				continue;
			}

			if (!hasYamlKey(mergedBody, key)) {
				mergedBody = appendYamlLine(mergedBody, line);
			}
		}
	}

	return mergedBody;
}

function isYamlPropertyNested(lines: string[], index: number): boolean {
	const nextLine = lines[index + 1];

	return nextLine !== undefined && (nextLine.startsWith(" ") || nextLine.startsWith("\t"));
}

function hasYamlKey(body: string, propertyName: string): boolean {
	return body.split(/\r?\n/).some((line) => isYamlKeyLine(line, propertyName));
}

function appendYamlLine(body: string, line: string): string {
	if (!body) {
		return line;
	}

	const lineEnd = body.includes("\r\n") ? "\r\n" : "\n";
	return `${body}${lineEnd}${line}`;
}

function updateYamlScalar(body: string, propertyName: string, value: string | number | null): string {
	const lines = body.length ? body.split(/\r?\n/) : [];
	const lineEnd = body.includes("\r\n") ? "\r\n" : "\n";
	const keyIndex = lines.findIndex((line) => isYamlKeyLine(line, propertyName));
	const shouldDelete = value === null || value === "";

	if (keyIndex !== -1) {
		if (shouldDelete) {
			const deleteEnd = findYamlPropertyEnd(lines, keyIndex);
			lines.splice(keyIndex, deleteEnd - keyIndex);
		} else {
			lines[keyIndex] = `${formatYamlKey(propertyName)}: ${formatYamlScalar(value)}`;
		}

		return lines.join(lineEnd);
	}

	if (shouldDelete) {
		return body;
	}

	lines.push(`${formatYamlKey(propertyName)}: ${formatYamlScalar(value)}`);
	return lines.join(lineEnd);
}

function isYamlKeyLine(line: string, propertyName: string): boolean {
	return line.match(/^\S[^:]*:/) !== null && getYamlLineKey(line) === propertyName;
}

function getYamlLineKey(line: string): string {
	const separatorIndex = line.indexOf(":");
	if (separatorIndex === -1) {
		return "";
	}

	const rawKey = line.slice(0, separatorIndex).trim();

	if (
		(rawKey.startsWith("\"") && rawKey.endsWith("\""))
		|| (rawKey.startsWith("'") && rawKey.endsWith("'"))
	) {
		return rawKey.slice(1, -1);
	}

	return rawKey;
}

function findYamlPropertyEnd(lines: string[], startIndex: number): number {
	let endIndex = startIndex + 1;

	while (endIndex < lines.length) {
		const line = lines[endIndex];
		if (line === undefined || (!line.startsWith(" ") && !line.startsWith("\t") && line.trim() !== "")) {
			break;
		}

		endIndex += 1;
	}

	return endIndex;
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

function getProjectWarnings(_properties: ProjectPropertyValue[]): string[] {
	return [];
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
