/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {
	getCompatibleRenderModes,
	getIconScaleRenderIcon,
	getIconScaleValues,
	getPropertyRenderModeLabel,
	normalizeProjectPropertyDefinitions,
	normalizePropertyRenderMode,
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
