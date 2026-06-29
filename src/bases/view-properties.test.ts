/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {getBoardClassName, normalizeBoardCardLayout, normalizeColorfulBoard} from "./board-appearance";
import {buildProjectBaseContent} from "./base-file";
import type {ProjectPropertyDefinition} from "../project-properties";
import type {SimpleProjectViewsSettings} from "../settings";
import {
	getProjectTableClassName,
	normalizeShowTableColumnDividers,
	shouldUseReadOnlyProgressTableCell,
} from "./table-appearance";
import {
	MIN_TABLE_COLUMN_WIDTH,
	normalizeTableColumnWidths,
	resetTableColumnWidth,
	setTableColumnWidth,
} from "./table-column-widths";
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
	relationshipPropertyNames: {
		parent: "parent",
		children: "children",
	},
	relationshipsEnabled: true,
	relationshipDetailFields: ["status"],
	projectProperties,
	statusOptions: ["todo", "in-progress", "done"],
	statusColors: {},
	statusDisplay: "colored-outline",
	showProjectToolbar: true,
	noteToolbarPosition: "top",
	prettyLinksEnabled: true,
	prettyLinkShowPropertyNames: true,
	prettyLinkFields: ["status"],
	projectCreationPathTemplate: "Projects/{{safe_title}}.md",
	projectCreationTemplatePath: "",
	baseFilePath: "Project views.base",
	boardColumnWidth: 280,
	colorfulBoard: false,
	boardCardLayout: "default",
	showTableColumnDividers: true,
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

void test("resolves raw Base property tokens alongside native property IDs", () => {
	const resolved = resolveProjectViewProperties(
		settings,
		["progress", "status", "icon", "file.name", "next_action"],
		(propertyId) => propertyId === "note.progress" ? "Completion" : propertyId,
	);

	assert.deepEqual(resolved.tableColumns.map((column) => column.propertyId), [
		"note.progress",
		"note.status",
		"note.icon",
		"file.name",
		"note.next_action",
	]);
	assert.deepEqual(resolved.tableColumns.map((column) => column.configPropertyId), [
		"progress",
		"status",
		"icon",
		"file.name",
		"next_action",
	]);
	assert.equal(resolved.tableColumns[0]?.label, "Completion");
});

void test("does not force file name into an explicit Bases view property order", () => {
	const resolved = resolveProjectViewProperties(settings, ["note.status"], (propertyId) => propertyId);

	assert.deepEqual(resolved.tableColumns.map((column) => column.propertyId), ["note.status"]);
});

void test("generated Bases views only show file name by default", () => {
	const content = buildProjectBaseContent(settings);

	assert.equal(countOccurrences(content, "      - file.name"), 4);
	assert.equal(countOccurrences(content, "      - status"), 0);
	assert.equal(countOccurrences(content, "      - icon"), 0);
	assert.equal(countOccurrences(content, "      - progress"), 0);
	assert.equal(countOccurrences(content, "      - next_action"), 0);
});

void test("normalizes table column widths for the current columns", () => {
	const widths = normalizeTableColumnWidths({
		"file.name": 240.4,
		"note.status": 12,
		"note.stale": 300,
	}, ["file.name", "note.status"]);

	assert.deepEqual(widths, {
		"file.name": 240,
		"note.status": MIN_TABLE_COLUMN_WIDTH,
	});
});

void test("sets and resets table column widths by property id", () => {
	const widths = setTableColumnWidth({"file.name": 240}, "note.status", 320.8);
	const resetWidths = resetTableColumnWidth(widths, "file.name");

	assert.deepEqual(widths, {
		"file.name": 240,
		"note.status": 321,
	});
	assert.deepEqual(resetWidths, {
		"note.status": 321,
	});
});

void test("normalizes colorful board setting and class name", () => {
	assert.equal(normalizeColorfulBoard(undefined), false);
	assert.equal(normalizeColorfulBoard(false), false);
	assert.equal(normalizeColorfulBoard(true), true);
	assert.equal(getBoardClassName(false, "default"), "spv-board spv-board-card-layout-default");
	assert.equal(getBoardClassName(true, "compact"), "spv-board spv-board-colorful spv-board-card-layout-compact");
	assert.equal(getBoardClassName(true, "spacious"), "spv-board spv-board-colorful spv-board-card-layout-spacious");
});

void test("normalizes board card layout setting", () => {
	assert.equal(normalizeBoardCardLayout(undefined), "default");
	assert.equal(normalizeBoardCardLayout("default"), "default");
	assert.equal(normalizeBoardCardLayout("spacious"), "spacious");
	assert.equal(normalizeBoardCardLayout("compact"), "compact");
	assert.equal(normalizeBoardCardLayout("dense"), "default");
});

void test("normalizes table column divider setting and class name", () => {
	assert.equal(normalizeShowTableColumnDividers(undefined), true);
	assert.equal(normalizeShowTableColumnDividers(true), true);
	assert.equal(normalizeShowTableColumnDividers(false), false);
	assert.equal(getProjectTableClassName(true), "spv-project-table spv-project-table-column-dividers");
	assert.equal(getProjectTableClassName(false), "spv-project-table");
});

void test("uses read-only progress displays for table progress cells until editing", () => {
	assert.equal(shouldUseReadOnlyProgressTableCell(settings, "progress", false), true);
	assert.equal(shouldUseReadOnlyProgressTableCell(settings, "progress", true), false);
	assert.equal(shouldUseReadOnlyProgressTableCell(settings, "nextAction", false), false);
	assert.equal(shouldUseReadOnlyProgressTableCell(settings, "missing", false), false);
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
