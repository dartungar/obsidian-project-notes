/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSettings} from "../settings";
import type {ProjectInfo} from "../project-metadata";
import {getPrettyLinkVisibleFields} from "./pretty-project-link-fields";

void test("selects status and non-empty configured properties", () => {
	const settings = normalizeSettings({
		prettyLinkFields: ["status", "due", "nextAction"],
	});
	const project = makeProject({
		status: "in-progress",
		properties: [
			{
				definition: settings.projectProperties.find((property) => property.id === "due")!,
				raw: "2026-07-01",
				value: "2026-07-01",
				numberValue: null,
			},
			{
				definition: settings.projectProperties.find((property) => property.id === "nextAction")!,
				raw: "",
				value: "",
				numberValue: null,
			},
		],
	});

	assert.deepEqual(getPrettyLinkVisibleFields(settings, project), ["status", "due"]);
});

void test("keeps status visible when status is selected but empty", () => {
	const settings = normalizeSettings({
		prettyLinkFields: ["status"],
	});

	assert.deepEqual(getPrettyLinkVisibleFields(settings, makeProject({status: ""})), ["status"]);
});

void test("returns no fields when pretty links are title-only", () => {
	const settings = normalizeSettings({
		prettyLinkFields: [],
	});

	assert.deepEqual(getPrettyLinkVisibleFields(settings, makeProject({status: "todo"})), []);
});

function makeProject(project: Partial<ProjectInfo>): ProjectInfo {
	return {
		file: {path: "Projects/Test.md", basename: "Test"} as ProjectInfo["file"],
		title: "Test",
		icon: "",
		status: "",
		properties: [],
		relationships: {parent: null, children: []},
		...project,
	};
}
