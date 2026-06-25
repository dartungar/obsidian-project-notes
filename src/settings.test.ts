/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSettings} from "./settings";

void test("uses default relationship property names", () => {
	const settings = normalizeSettings();

	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent",
		children: "children",
	});
});

void test("trims configured relationship property names", () => {
	const settings = normalizeSettings({
		relationshipPropertyNames: {
			parent: " parent_project ",
			children: " child_projects ",
		},
	});

	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent_project",
		children: "child_projects",
	});
});

void test("falls back when relationship property names are empty", () => {
	const settings = normalizeSettings({
		relationshipPropertyNames: {
			parent: " ",
			children: "",
		},
	});

	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent",
		children: "children",
	});
});
