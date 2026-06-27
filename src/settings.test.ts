/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSettings} from "./settings";

void test("uses default relationship property names", () => {
	const settings = normalizeSettings();

	assert.equal(settings.relationshipsEnabled, true);
	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent",
		children: "children",
	});
	assert.deepEqual(settings.relationshipDetailFields, ["status"]);
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

void test("normalizes relationship display settings", () => {
	const settings = normalizeSettings({
		relationshipsEnabled: false,
		relationshipDetailFields: [" status ", "due", "", "status", "nextAction"],
	});

	assert.equal(settings.relationshipsEnabled, false);
	assert.deepEqual(settings.relationshipDetailFields, ["status", "due", "nextAction"]);
});

void test("allows relationship detail fields to be empty", () => {
	const settings = normalizeSettings({
		relationshipDetailFields: [],
	});

	assert.deepEqual(settings.relationshipDetailFields, []);
});
