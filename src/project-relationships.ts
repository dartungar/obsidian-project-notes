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
