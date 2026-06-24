/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {
	type BasesWritableSortConfig,
	getColumnSort,
	getNextColumnSortDirection,
	hideColumnFromOrder,
	normalizeTablePropertyOrder,
	normalizeTableSorts,
	setBasesPropertyOrder,
	setBasesSortProperty,
	sortProjectsByTableSort,
} from "./table-sorting";
import type {ProjectInfo} from "../project-metadata";
import type {ProjectViewColumn} from "./view-properties";

const existingSort: BasesWritableSortConfig[] = [
	{property: "note.status", direction: "ASC"},
	{property: "file.name", direction: "DESC"},
];

void test("chooses the next table column sort direction", () => {
	assert.equal(getNextColumnSortDirection(existingSort, ["note.icon", "icon"]), "ASC");
	assert.equal(getNextColumnSortDirection(existingSort, ["note.status", "status"]), "DESC");
});

void test("finds a table column sort by raw or normalized property token", () => {
	assert.deepEqual(getColumnSort(existingSort, ["note.status", "status"]), {property: "note.status", direction: "ASC"});
	assert.deepEqual(getColumnSort([{property: "status", direction: "ASC"}], ["note.status", "status"]), {
		property: "status",
		direction: "ASC",
	});
});

void test("hides a table column from the configured property order", () => {
	assert.deepEqual(hideColumnFromOrder(["file.name", "note.status", "note.icon"], ["note.status", "status"]), [
		"file.name",
		"note.icon",
	]);
});

void test("normalizes raw table sort and order property tokens before writing Bases config", () => {
	const columns: ProjectViewColumn[] = [
		column("title", "Project", "file.name", "file.name"),
		column("status", "Status", "note.status", "status"),
		column("icon", "Icon", "note.icon", "icon"),
	];

	assert.deepEqual(normalizeTableSorts([
		{property: "status", direction: "ASC"},
		{property: "file.name", direction: "DESC"},
		{property: "note.icon", direction: "ASC"},
	], columns), [
		{property: "note.status", direction: "ASC"},
		{property: "file.name", direction: "DESC"},
		{property: "note.icon", direction: "ASC"},
	]);
	assert.deepEqual(normalizeTablePropertyOrder(["file.name", "status", "icon"], columns), [
		"file.name",
		"note.status",
		"note.icon",
	]);
});

void test("writes table sort through the native Bases sort property mutator", () => {
	const calls: unknown[] = [];
	const config = {
		setSortProperty(property: string, direction: string) {
			calls.push(["setSortProperty", property, direction]);
		},
		set(key: string, value: unknown) {
			calls.push(["set", key, value]);
		},
	};

	assert.equal(setBasesSortProperty(config, "note.status", "DESC"), true);
	assert.deepEqual(calls, [["setSortProperty", "note.status", "DESC"]]);
});

void test("writes table order through the native Bases order mutator", () => {
	const calls: unknown[] = [];
	const config = {
		setOrder(order: string[]) {
			calls.push(["setOrder", order]);
		},
		set(key: string, value: unknown) {
			calls.push(["set", key, value]);
		},
	};

	assert.equal(setBasesPropertyOrder(config, ["file.name", "note.status"]), true);
	assert.deepEqual(calls, [["setOrder", ["file.name", "note.status"]]]);
});

void test("sorts table projects locally by configured column sort", () => {
	const projects = [
		project("Beta", "done", 10),
		project("Alpha", "backlog", 30),
		project("Gamma", "done", 20),
	];
	const columns: ProjectViewColumn[] = [
		column("status", "Status", "note.status", "status"),
		column("progress", "Progress", "note.progress", "progress"),
	];

	const sorted = sortProjectsByTableSort(projects, columns, [
		{property: "note.status", direction: "ASC"},
		{property: "note.progress", direction: "DESC"},
	]);

	assert.deepEqual(sorted.map((item) => item.title), ["Alpha", "Gamma", "Beta"]);
	assert.deepEqual(projects.map((item) => item.title), ["Beta", "Alpha", "Gamma"]);
});

function column(key: string, label: string, propertyId: string, configPropertyId: string): ProjectViewColumn {
	return {
		key,
		label,
		propertyId: propertyId as ProjectViewColumn["propertyId"],
		configPropertyId,
		field: key,
	};
}

function project(title: string, status: string, progress: number): ProjectInfo {
	return {
		file: {path: `${title}.md`} as ProjectInfo["file"],
		title,
		icon: "",
		status,
		properties: [
			{
				definition: {
					id: "progress",
					name: "progress",
					label: "Progress",
					type: "number",
					render: "progress",
					icon: "",
					labelMode: "name",
					min: 0,
					max: 100,
					step: 1,
				},
				raw: progress,
				value: String(progress),
				numberValue: progress,
			},
		],
	};
}
