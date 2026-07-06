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
