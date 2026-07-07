/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {App} from "obsidian";
import {
	DEFAULT_SETTINGS,
	getProjectPropertyMaximumSettingDescription,
	getProjectPropertyEditToggle,
	getProjectPropertyStepSettingDescription,
	getOrderedPrettyLinkFields,
	getStatusDisplayClassName,
	normalizePrettyLinkFields,
	normalizeSettings,
	normalizeStatusDisplay,
	shouldShowProjectPropertyRangeSettings,
	shouldShowProjectPropertyOptionSettings,
	shouldShowProjectPropertyStepSetting,
	SimpleProjectViewsSettingTab,
} from "./settings";
import type SimpleProjectViewsPlugin from "./main";
import type {ProjectPropertyOptionDefinition} from "./project-properties";

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
		options: [],
		optionsColored: false,
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

void test("exposes range and step settings for icon scale render modes", () => {
	assert.equal(shouldShowProjectPropertyRangeSettings("progress"), true);
	assert.equal(shouldShowProjectPropertyRangeSettings("stars"), true);
	assert.equal(shouldShowProjectPropertyRangeSettings("pips"), true);
	assert.equal(shouldShowProjectPropertyRangeSettings("icons"), true);
	assert.equal(shouldShowProjectPropertyRangeSettings("text"), false);
	assert.equal(shouldShowProjectPropertyRangeSettings("date"), false);

	assert.equal(shouldShowProjectPropertyStepSetting("progress"), true);
	assert.equal(shouldShowProjectPropertyStepSetting("stars"), true);
	assert.equal(shouldShowProjectPropertyStepSetting("pips"), true);
	assert.equal(shouldShowProjectPropertyStepSetting("icons"), true);
	assert.equal(shouldShowProjectPropertyStepSetting("text"), false);
	assert.equal(shouldShowProjectPropertyStepSetting("datetime"), false);

	assert.equal(getProjectPropertyMaximumSettingDescription("icons"), "Largest selectable value.");
	assert.equal(getProjectPropertyMaximumSettingDescription("progress"), "Largest allowed number.");
	assert.equal(getProjectPropertyStepSettingDescription("pips"), "Distance between selectable values.");
	assert.equal(getProjectPropertyStepSettingDescription("progress"), "Slider increment.");
});

void test("keeps icon scale step settings", () => {
	const settings = normalizeSettings({
		projectProperties: [
			{
				id: "complexity",
				name: "complexity",
				label: "Complexity",
				type: "number",
				render: "pips",
				icon: "circle",
				labelMode: "name",
				min: 0,
				max: 10,
				step: 2,
				options: [],
				optionsColored: false,
			},
		],
	});

	assert.deepEqual(settings.projectProperties.map((property) => ({
		render: property.render,
		min: property.min,
		max: property.max,
		step: property.step,
	})), [
		{render: "pips", min: 0, max: 10, step: 2},
	]);
});

void test("normalizes select and multiselect option settings", () => {
	const settings = normalizeSettings({
		projectProperties: [
			{
				id: "phase",
				name: "phase",
				label: "Phase",
				type: "text",
				render: "select",
				icon: "",
				labelMode: "name",
				min: 0,
				max: 100,
				step: 5,
				optionsColored: true,
				options: [
					{id: "idea", value: "Idea", color: "#123abc"},
					{id: "duplicate", value: "Idea", color: "#ffffff"},
					{id: "", value: "Build", color: "invalid"},
				],
			},
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
				optionsColored: false,
				options: [{id: "ops", value: "Ops", color: "#35a35c"}],
			},
		],
	});

	assert.equal(settings.projectProperties[0]?.render, "select");
	assert.equal(settings.projectProperties[0]?.optionsColored, true);
	assert.deepEqual(settings.projectProperties[0]?.options.map((option) => option.value), ["Idea", "Build"]);
	assert.equal(settings.projectProperties[1]?.type, "list");
	assert.equal(settings.projectProperties[1]?.render, "multiselect");
	assert.deepEqual(settings.projectProperties[1]?.options.map((option) => option.value), ["Ops"]);
});

void test("shows option settings only for select render modes", () => {
	assert.equal(shouldShowProjectPropertyOptionSettings("select"), true);
	assert.equal(shouldShowProjectPropertyOptionSettings("multiselect"), true);
	assert.equal(shouldShowProjectPropertyOptionSettings("text"), false);
	assert.equal(shouldShowProjectPropertyOptionSettings("progress"), false);
});

void test("uses edit and done icons for project property editing", () => {
	assert.deepEqual(getProjectPropertyEditToggle(false), {
		icon: "pencil",
		tooltip: "Edit property",
	});
	assert.deepEqual(getProjectPropertyEditToggle(true), {
		icon: "check",
		tooltip: "Done editing",
	});
});

void test("updates project property option text without rerendering settings", async () => {
	let saveCount = 0;
	const plugin = {
		settings: normalizeSettings({
			projectProperties: [
				{
					id: "area",
					name: "area",
					label: "Area",
					type: "text",
					render: "select",
					icon: "",
					labelMode: "name",
					min: 0,
					max: 100,
					step: 5,
					optionsColored: true,
					options: [{id: "option-1", value: "Option 1", color: "#d8892b"}],
				},
			],
		}),
		saveSettings: async () => {
			saveCount += 1;
		},
	} as unknown as SimpleProjectViewsPlugin;
	const tab = new SimpleProjectViewsSettingTab(new App(), plugin) as unknown as {
		renderSettings: () => void;
		updateProjectPropertyOption: (
			propertyIndex: number,
			optionIndex: number,
			option: Partial<ProjectPropertyOptionDefinition>,
		) => Promise<void>;
	};
	let renderCount = 0;
	tab.renderSettings = () => {
		renderCount += 1;
	};

	await tab.updateProjectPropertyOption(0, 0, {value: "Design"});

	assert.equal(saveCount, 1);
	assert.equal(renderCount, 0);
	assert.equal(plugin.settings.projectProperties[0]?.options[0]?.value, "Design");
});

void test("normalizes board color mode and migrates the legacy colorful toggle", () => {
	assert.equal(normalizeSettings().boardColorMode, "plain");
	assert.equal(normalizeSettings({colorfulBoard: true}).boardColorMode, "colorful");
	assert.equal(normalizeSettings({colorfulBoard: false}).boardColorMode, "plain");
	assert.equal(normalizeSettings({boardColorMode: "subtle" as never}).boardColorMode, "subtle");
	assert.equal(normalizeSettings({boardColorMode: "colorful" as never}).colorfulBoard, true);
	assert.equal(normalizeSettings({boardColorMode: "plain" as never}).colorfulBoard, false);
	assert.equal(normalizeSettings({boardColorMode: "noisy" as never, colorfulBoard: true}).boardColorMode, "colorful");
});
