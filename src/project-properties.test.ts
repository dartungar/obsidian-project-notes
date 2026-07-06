/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {
	formatProjectPropertyValue,
	getCompatibleRenderModes,
	getIconScaleRenderIcon,
	getIconScaleValues,
	getProjectPropertyOptionDisplay,
	getProjectPropertyOptionDisplays,
	getPropertyRenderModeLabel,
	getPropertyTypeLabel,
	normalizeProjectPropertyDefinitions,
	normalizePropertyInputValue,
	normalizePropertyRenderMode,
	normalizePropertyType,
	readProjectPropertyValue,
} from "./project-properties";

void test("labels text and icon scale render modes", () => {
	assert.equal(getPropertyRenderModeLabel("text"), "Text");
	assert.equal(getPropertyRenderModeLabel("stars"), "Stars");
	assert.equal(getPropertyRenderModeLabel("pips"), "Pips");
	assert.equal(getPropertyRenderModeLabel("icons"), "Icons");
});

void test("supports icon scale render modes only for number properties", () => {
	assert.deepEqual(getCompatibleRenderModes("number"), ["progress", "stars", "pips", "icons", "text"]);
	assert.equal(normalizePropertyRenderMode("number", "pips"), "pips");
	assert.equal(normalizePropertyRenderMode("number", "icons"), "icons");
	assert.equal(normalizePropertyRenderMode("text", "pips"), "text");
	assert.equal(normalizePropertyRenderMode("date", "icons"), "date");
});

void test("normalizes icon scale defaults and preserves saved stars", () => {
	const [stars, pips, icons] = normalizeProjectPropertyDefinitions([
		{id: "rating", name: "rating", label: "Rating", type: "number", render: "stars"},
		{id: "complexity", name: "complexity", label: "Complexity", type: "number", render: "pips"},
		{id: "priority", name: "priority", label: "Priority", type: "number", render: "icons", icon: "flag", max: 4, step: 2},
	]);

	assert.equal(stars?.render, "stars");
	assert.equal(stars?.max, 5);
	assert.equal(stars?.step, 1);
	assert.equal(pips?.render, "pips");
	assert.equal(pips?.max, 5);
	assert.equal(pips?.step, 1);
	assert.equal(icons?.render, "icons");
	assert.equal(icons?.max, 4);
	assert.equal(icons?.step, 2);
});

void test("generates stepped icon scale values", () => {
	assert.deepEqual(getIconScaleValues({min: 0, max: 5, step: 1}), [1, 2, 3, 4, 5]);
	assert.deepEqual(getIconScaleValues({min: 0, max: 10, step: 2}), [2, 4, 6, 8, 10]);
	assert.deepEqual(getIconScaleValues({min: 2, max: 6, step: 2}), [2, 4, 6]);
	assert.equal(getIconScaleValues({min: 1, max: 30, step: 1}).length, 12);
});

void test("resolves icon scale glyphs from render mode and property icon", () => {
	assert.equal(getIconScaleRenderIcon({render: "stars", icon: "flag"}), "star");
	assert.equal(getIconScaleRenderIcon({render: "pips", icon: "flag"}), "circle");
	assert.equal(getIconScaleRenderIcon({render: "icons", icon: "flag"}), "flag");
	assert.equal(getIconScaleRenderIcon({render: "icons", icon: ""}), "circle");
});

void test("supports select and multiselect render modes for text and list properties", () => {
	assert.equal(getPropertyTypeLabel("list"), "List");
	assert.deepEqual(getCompatibleRenderModes("text"), ["text", "textarea", "select"]);
	assert.deepEqual(getCompatibleRenderModes("list"), ["multiselect"]);
	assert.equal(normalizePropertyRenderMode("text", "select"), "select");
	assert.equal(normalizePropertyRenderMode("list", "multiselect"), "multiselect");
	assert.equal(normalizePropertyRenderMode("number", "select"), "progress");
	assert.equal(normalizePropertyRenderMode("text", "multiselect"), "text");
	assert.equal(normalizePropertyType("list"), "list");
});

void test("normalizes select options and repairs option colors", () => {
	const [property] = normalizeProjectPropertyDefinitions([
		{
			id: "phase",
			name: "phase",
			label: "Phase",
			type: "text",
			render: "select",
			optionsColored: true,
			options: [
				{id: "idea", value: " Idea ", color: "#123abc"},
				{id: "duplicate", value: "Idea", color: "#000000"},
				{id: "", value: "Build", color: "nope"},
				{id: "blank", value: " ", color: "#ffffff"},
			],
		},
	]);

	assert.equal(property?.type, "text");
	assert.equal(property?.render, "select");
	assert.equal(property?.optionsColored, true);
	assert.deepEqual(property?.options.map((option) => option.value), ["Idea", "Build"]);
	assert.equal(property?.options[0]?.id, "idea");
	assert.equal(property?.options[0]?.color, "#123abc");
	assert.match(property?.options[1]?.id ?? "", /^build/);
	assert.match(property?.options[1]?.color ?? "", /^#[0-9a-f]{6}$/);
});

void test("defaults option metadata for existing properties", () => {
	const [property] = normalizeProjectPropertyDefinitions([
		{id: "phase", name: "phase", label: "Phase", type: "text", render: "text"},
	]);

	assert.deepEqual(property?.options, []);
	assert.equal(property?.optionsColored, false);
});

void test("reads scalar and list project property values", () => {
	const [selectProperty, multiselectProperty] = normalizeProjectPropertyDefinitions([
		{id: "phase", name: "phase", label: "Phase", type: "text", render: "select"},
		{id: "areas", name: "areas", label: "Areas", type: "list", render: "multiselect"},
	]);

	const selectValue = readProjectPropertyValue(selectProperty!, "Build");
	const multiValue = readProjectPropertyValue(multiselectProperty!, ["Ops", "Design", "Ops", " "]);

	assert.equal(selectValue.value, "Build");
	assert.deepEqual(selectValue.values, ["Build"]);
	assert.equal(formatProjectPropertyValue(selectValue), "Build");
	assert.equal(multiValue.value, "Ops, Design");
	assert.deepEqual(multiValue.values, ["Ops", "Design"]);
	assert.equal(formatProjectPropertyValue(multiValue), "Ops, Design");
});

void test("normalizes list input values", () => {
	const [property] = normalizeProjectPropertyDefinitions([
		{id: "areas", name: "areas", label: "Areas", type: "list", render: "multiselect"},
	]);

	assert.deepEqual(normalizePropertyInputValue(property!, [" Ops ", "Design", "Ops", ""]), ["Ops", "Design"]);
	assert.deepEqual(normalizePropertyInputValue(property!, "Ops"), ["Ops"]);
	assert.equal(normalizePropertyInputValue(property!, []), null);
});

void test("resolves configured and unknown option displays", () => {
	const [property] = normalizeProjectPropertyDefinitions([
		{
			id: "phase",
			name: "phase",
			label: "Phase",
			type: "text",
			render: "select",
			optionsColored: true,
			options: [{id: "build", value: "Build", color: "#35a35c"}],
		},
	]);

	assert.deepEqual(getProjectPropertyOptionDisplay(property!, "Build"), {
		value: "Build",
		color: "#35a35c",
		isConfigured: true,
	});
	assert.deepEqual(getProjectPropertyOptionDisplay(property!, "Unknown"), {
		value: "Unknown",
		color: "#8a8a8a",
		isConfigured: false,
	});
	assert.deepEqual(getProjectPropertyOptionDisplays(property!, ["Build", "Unknown"]).map((option) => option.value), ["Build", "Unknown"]);
});
