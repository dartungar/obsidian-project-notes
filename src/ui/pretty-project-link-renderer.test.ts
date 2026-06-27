/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {normalizeSettings} from "../settings";
import {resolvePrettyProjectLink} from "./pretty-project-link-renderer";

void test("resolves a project note link into pretty link data", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const plugin = makePlugin(file, project);

	const data = resolvePrettyProjectLink(plugin, "Projects/Apollo", "Daily.md", "Apollo project");

	assert.equal(data?.file, file);
	assert.equal(data?.project, project);
	assert.equal(data?.sourcePath, "Daily.md");
	assert.equal(data?.linktext, "Projects/Apollo");
	assert.equal(data?.label, "Apollo project");
});

void test("uses project title when link label is empty", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const plugin = makePlugin(file, project);

	const data = resolvePrettyProjectLink(plugin, "Projects/Apollo", "Daily.md");

	assert.equal(data?.label, "Apollo");
});

void test("does not resolve disabled, subpath, unresolved, or non-project links", () => {
	const file = makeFile("Projects/Apollo.md", "Apollo");
	const project = makeProject(file);
	const disabledPlugin = makePlugin(file, project, {prettyLinksEnabled: false});
	const plugin = makePlugin(file, null);

	assert.equal(resolvePrettyProjectLink(disabledPlugin, "Projects/Apollo", "Daily.md"), null);
	assert.equal(resolvePrettyProjectLink(makePlugin(file, project), "Projects/Apollo#Heading", "Daily.md"), null);
	assert.equal(resolvePrettyProjectLink(makePlugin(null, null), "Projects/Missing", "Daily.md"), null);
	assert.equal(resolvePrettyProjectLink(plugin, "Projects/Apollo", "Daily.md"), null);
});

function makePlugin(
	resolvedFile: TFile | null,
	project: ProjectInfo | null,
	settings: Partial<ReturnType<typeof normalizeSettings>> = {},
): SimpleProjectViewsPlugin {
	return {
		settings: normalizeSettings(settings),
		app: {
			metadataCache: {
				getFirstLinkpathDest: () => resolvedFile,
			},
		},
		projectIndex: {
			getProject: () => project,
		},
	} as unknown as SimpleProjectViewsPlugin;
}

function makeFile(path: string, basename: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = basename;
	return file;
}

function makeProject(file: TFile): ProjectInfo {
	return {
		file,
		title: file.basename,
		icon: "",
		status: "todo",
		properties: [],
		relationships: {parent: null, children: []},
	};
}
