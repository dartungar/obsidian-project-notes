/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {buildProjectBaseContent} from "./base-file";
import type {ProjectPropertyDefinition} from "../project-properties";
import type {SimpleProjectViewsSettings} from "../settings";
import {resolveProjectViewProperties} from "./view-properties";

const projectProperties: ProjectPropertyDefinition[] = [
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
];

const settings: SimpleProjectViewsSettings = {
	projectMatchType: "tag",
	projectTag: "project",
	projectPropertyName: "",
	projectPropertyValue: "",
	projectFolder: "",
	enabledProperties: {
		icon: true,
		progress: true,
		due: true,
		delegatedTo: true,
		followUp: true,
		nextAction: true,
		blockedReason: true,
	},
	propertyNames: {
		icon: "icon",
		status: "status",
		progress: "progress",
		due: "due",
		delegatedTo: "delegated_to",
		followUp: "follow_up",
		nextAction: "next_action",
		blockedReason: "blocked_reason",
	},
	projectProperties,
	statusOptions: ["todo", "in-progress", "done"],
	statusColors: {},
	showProjectToolbar: true,
	noteToolbarPosition: "top",
	projectCreationPathTemplate: "Projects/{{safe_title}}.md",
	projectCreationTemplatePath: "",
	baseFilePath: "Project views.base",
	boardColumnWidth: 280,
	boardColumnOrder: [],
	boardCardOrder: [],
	collapsedBoardColumns: [],
};

void test("defaults custom Bases views to file name only", () => {
	const resolved = resolveProjectViewProperties(settings, [], (propertyId) => propertyId);

	assert.equal(resolved.showTitleIcon, false);
	assert.deepEqual(resolved.controlFields, []);
	assert.deepEqual(resolved.tableColumns.map((column) => column.propertyId), ["file.name"]);
});

void test("respects current Bases view property order", () => {
	const resolved = resolveProjectViewProperties(
		settings,
		["note.progress", "note.status", "note.icon", "file.name", "note.next_action"],
		(propertyId) => propertyId === "note.progress" ? "Completion" : propertyId,
	);

	assert.equal(resolved.showTitleIcon, true);
	assert.deepEqual(resolved.controlFields, ["progress", "status", "icon", "nextAction"]);
	assert.deepEqual(resolved.tableColumns.map((column) => column.propertyId), [
		"note.progress",
		"note.status",
		"note.icon",
		"file.name",
		"note.next_action",
	]);
	assert.equal(resolved.tableColumns[0]?.label, "Completion");
});

void test("generated Bases views only show file name by default", () => {
	const content = buildProjectBaseContent(settings);

	assert.equal(countOccurrences(content, "      - file.name"), 4);
	assert.equal(countOccurrences(content, "      - status"), 0);
	assert.equal(countOccurrences(content, "      - icon"), 0);
	assert.equal(countOccurrences(content, "      - progress"), 0);
	assert.equal(countOccurrences(content, "      - next_action"), 0);
});

function countOccurrences(value: string, needle: string): number {
	let count = 0;
	let index = value.indexOf(needle);
	while (index !== -1) {
		count += 1;
		index = value.indexOf(needle, index + needle.length);
	}

	return count;
}
