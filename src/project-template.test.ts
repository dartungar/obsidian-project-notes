/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {buildProjectContent} from "./project-template";
import {normalizeSettings} from "./settings";

void test("writes list-backed project creation values as YAML lists", () => {
	const settings = normalizeSettings({
		projectProperties: [
			{
				id: "areas",
				name: "areas",
				label: "Areas",
				type: "list",
				render: "multiselect",
				icon: "",
				labelMode: "name",
				min: 0,
				max: 100,
				step: 5,
				options: [],
				optionsColored: false,
			},
		],
	});

	const content = buildProjectContent(settings, {
		title: "Apollo",
		icon: "",
		status: "",
		propertyValues: {areas: ["Ops", "Design"]},
	}, "---\n{{project_properties}}\n---\n{{areas}}");

	assert.equal(content, [
		"---",
		"tags:",
		"  - project",
		"areas:",
		"  - Ops",
		"  - Design",
		"---",
		"Ops, Design",
		"",
	].join("\n"));
});

void test("writes project creation values when a custom template omits the project properties token", () => {
	const settings = normalizeSettings({
		projectProperties: [
			{
				id: "progress",
				name: "progress",
				label: "Progress",
				type: "number",
				render: "progress",
				icon: "",
				labelMode: "name",
				min: 0,
				max: 100,
				step: 5,
				options: [],
				optionsColored: false,
			},
			{
				id: "due",
				name: "due",
				label: "Due",
				type: "date",
				render: "date",
				icon: "",
				labelMode: "name",
				min: 0,
				max: 100,
				step: 5,
				options: [],
				optionsColored: false,
			},
		],
	});

	const content = buildProjectContent(settings, {
		title: "Apollo",
		icon: "rocket",
		status: "in-progress",
		propertyValues: {progress: 65, due: "2026-08-12"},
	}, "---\ncssclasses:\n  - wide-page\n---\n# {{title}}");

	assert.equal(content, [
		"---",
		"cssclasses:",
		"  - wide-page",
		"tags:",
		"  - project",
		"status: in-progress",
		"icon: rocket",
		"progress: 65",
		"due: 2026-08-12",
		"---",
		"# Apollo",
		"",
	].join("\n"));
});

void test("adds frontmatter for project creation values when the template has none", () => {
	const settings = normalizeSettings({
		projectProperties: [],
	});

	const content = buildProjectContent(settings, {
		title: "Apollo",
		icon: "",
		status: "backlog",
		propertyValues: {},
	}, "# {{title}}");

	assert.equal(content, [
		"---",
		"tags:",
		"  - project",
		"status: backlog",
		"---",
		"# Apollo",
		"",
	].join("\n"));
});
