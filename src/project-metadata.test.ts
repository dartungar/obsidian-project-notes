/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {App, TFile} from "obsidian";
import {ProjectIndex, updateProjectProperty} from "./project-metadata";
import {DEFAULT_SETTINGS} from "./settings";
import type {SimpleProjectViewsSettings} from "./settings";

void test("property updates remain visible while the metadata cache catches up", async () => {
	const file = makeProjectFile();
	let content = "---\nstatus: old\n---\n";
	let cachedFrontmatter: Record<string, unknown> = {status: "old"};
	let finishWrite: (() => void) | undefined;
	const writeFinished = new Promise<void>((resolve) => {
		finishWrite = resolve;
	});
	const app = {
		metadataCache: {
			getFileCache: () => ({frontmatter: cachedFrontmatter}),
		},
		vault: {
			process: async (_file: TFile, update: (current: string) => string) => {
				content = update(content);
				await writeFinished;
				return content;
			},
		},
	} as unknown as App;
	const index = new ProjectIndex(app, makeSettings);

	const update = updateProjectProperty(app, file, "status", "new");
	assert.equal(index.getProject(file)?.status, "new");

	finishWrite?.();
	await update;
	assert.equal(index.getProject(file)?.status, "new");

	cachedFrontmatter = {status: "new"};
	assert.equal(index.getProject(file)?.status, "new");

	cachedFrontmatter = {status: "external change"};
	assert.equal(index.getProject(file)?.status, "external change");
});

void test("concurrent property updates use the vault atomic process API", async () => {
	const file = makeProjectFile();
	let content = "---\nstatus: old\nprogress: 0\n---\n";
	const app = {
		vault: {
			process: async (_file: TFile, update: (current: string) => string) => {
				content = update(content);
				return content;
			},
		},
	} as unknown as App;

	await Promise.all([
		updateProjectProperty(app, file, "status", "new"),
		updateProjectProperty(app, file, "progress", 50),
	]);

	assert.match(content, /^status: new$/m);
	assert.match(content, /^progress: 50$/m);
});

void test("a pending edit is not discarded just because the stale cache already has that value", async () => {
	const file = makeProjectFile();
	let cachedStatus = "old";
	let finishWrite: (() => void) | undefined;
	const writeFinished = new Promise<void>((resolve) => {
		finishWrite = resolve;
	});
	const app = {
		metadataCache: {
			getFileCache: () => ({frontmatter: {status: cachedStatus}}),
		},
		vault: {
			process: async (_file: TFile, update: (current: string) => string) => {
				update("---\nstatus: new\n---\n");
				await writeFinished;
				return "---\nstatus: old\n---\n";
			},
		},
	} as unknown as App;
	const index = new ProjectIndex(app, makeSettings);

	const update = updateProjectProperty(app, file, "status", "old");
	assert.equal(index.getProject(file)?.status, "old");
	cachedStatus = "new";
	assert.equal(index.getProject(file)?.status, "old");

	finishWrite?.();
	await update;
	assert.equal(index.getProject(file)?.status, "old");
});

function makeProjectFile(): TFile {
	const file = new TFile();
	file.path = "Projects/example.md";
	file.basename = "example";
	return file;
}

function makeSettings(): SimpleProjectViewsSettings {
	return {
		...DEFAULT_SETTINGS,
		projectMatchType: "folder",
		projectFolder: "Projects",
	};
}
