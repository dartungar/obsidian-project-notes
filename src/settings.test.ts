/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {
	DEFAULT_SETTINGS,
	getOrderedPrettyLinkFields,
	getStatusDisplayClassName,
	normalizePrettyLinkFields,
	normalizeSettings,
	normalizeStatusDisplay,
} from "./settings";

void test("uses default relationship property names", () => {
	const settings = normalizeSettings();

	assert.equal(settings.relationshipsEnabled, true);
	assert.deepEqual(settings.relationshipPropertyNames, {
		parent: "parent",
		children: "children",
	});
	assert.deepEqual(settings.relationshipDetailFields, ["status"]);
});

void test("uses status, progress, and due as the default project fields", () => {
	const settings = normalizeSettings();

	assert.deepEqual(settings.projectProperties.map((property) => property.id), ["progress", "due"]);
});

void test("uses defaults when saved plugin data is null", () => {
	const settings = normalizeSettings(null);

	assert.deepEqual(settings.propertyNames, DEFAULT_SETTINGS.propertyNames);
	assert.deepEqual(settings.relationshipPropertyNames, DEFAULT_SETTINGS.relationshipPropertyNames);
	assert.deepEqual(settings.relationshipDetailFields, DEFAULT_SETTINGS.relationshipDetailFields);
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

void test("normalizes status display setting and class names", () => {
	assert.equal(normalizeSettings().statusDisplay, "colored-outline");
	assert.equal(normalizeSettings({statusDisplay: "filled"}).statusDisplay, "filled");
	assert.equal(normalizeSettings({statusDisplay: "unsupported" as never}).statusDisplay, "colored-outline");

	assert.equal(normalizeStatusDisplay("text"), "text");
	assert.equal(normalizeStatusDisplay("colored-text"), "colored-text");
	assert.equal(normalizeStatusDisplay("outline"), "outline");
	assert.equal(normalizeStatusDisplay("colored-outline"), "colored-outline");
	assert.equal(normalizeStatusDisplay("filled"), "filled");
	assert.equal(normalizeStatusDisplay(null), "colored-outline");

	assert.equal(getStatusDisplayClassName("text"), "spv-status-badge spv-status-display-text");
	assert.equal(getStatusDisplayClassName("colored-text"), "spv-status-badge spv-status-display-colored-text");
	assert.equal(getStatusDisplayClassName("outline"), "spv-status-badge spv-status-display-outline");
	assert.equal(getStatusDisplayClassName("colored-outline"), "spv-status-badge spv-status-display-colored-outline");
	assert.equal(getStatusDisplayClassName("filled"), "spv-status-badge spv-status-display-filled");
});

void test("uses default pretty link settings", () => {
	const settings = normalizeSettings();

	assert.equal(settings.prettyLinksEnabled, true);
	assert.deepEqual(settings.prettyLinkFields, ["status"]);
	assert.equal(settings.prettyLinkShowPropertyNames, true);
	assert.deepEqual(DEFAULT_SETTINGS.prettyLinkFields, ["status"]);
	assert.equal(DEFAULT_SETTINGS.prettyLinkShowPropertyNames, true);
});

void test("normalizes pretty link fields", () => {
	const settings = normalizeSettings({
		prettyLinkFields: [" due ", "", "status", "unknown", "due", "nextAction"],
	});
	const customSettings = normalizeSettings({
		projectProperties: [
			...DEFAULT_SETTINGS.projectProperties,
			makeTextProperty("priority", "priority", "Priority"),
		],
		prettyLinkFields: [" due ", "", "status", "unknown", "due", "priority"],
	});

	assert.deepEqual(settings.prettyLinkFields, ["status", "due"]);
	assert.deepEqual(customSettings.prettyLinkFields, ["status", "due", "priority"]);
	assert.deepEqual(normalizePrettyLinkFields(["status", "due", "due"]), ["status", "due"]);
});

void test("allows title-only pretty links", () => {
	const settings = normalizeSettings({
		prettyLinkFields: [],
	});

	assert.deepEqual(settings.prettyLinkFields, []);
});

void test("orders pretty link fields from current project properties", () => {
	const settings = normalizeSettings({
		projectProperties: [
			...DEFAULT_SETTINGS.projectProperties,
			makeTextProperty("priority", "priority", "Priority"),
		],
		prettyLinkFields: ["priority", "status", "due"],
	});

	assert.deepEqual(getOrderedPrettyLinkFields(settings, new Set(settings.prettyLinkFields)), [
		"status",
		"due",
		"priority",
	]);
});

function makeTextProperty(id: string, name: string, label: string) {
	return {
		id,
		name,
		label,
		type: "text" as const,
		render: "text" as const,
		icon: "",
		labelMode: "name" as const,
		min: 0,
		max: 100,
		step: 5,
	};
}

void test("normalizes pretty links enabled", () => {
	assert.equal(normalizeSettings({prettyLinksEnabled: false}).prettyLinksEnabled, false);
	assert.equal(normalizeSettings({prettyLinksEnabled: "false" as never}).prettyLinksEnabled, true);
});

void test("normalizes pretty link property name visibility", () => {
	assert.equal(normalizeSettings({prettyLinkShowPropertyNames: false}).prettyLinkShowPropertyNames, false);
	assert.equal(normalizeSettings({prettyLinkShowPropertyNames: "false" as never}).prettyLinkShowPropertyNames, true);
});
