/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {getMultiSelectEditorState, removeMultiSelectEditorValue} from "./project-controls";
import type {ProjectPropertyDefinition} from "../project-properties";

void test("multiselect editor shows selected values separately from add choices", () => {
	const definition = makeMultiSelectProperty([
		{id: "delegated", value: "delegated", color: "#d8892b"},
		{id: "blocked", value: "blocked", color: "#d84c4c"},
		{id: "work", value: "work", color: "#35a35c"},
	]);

	const state = getMultiSelectEditorState(definition, ["blocked", "unknown"]);

	assert.deepEqual(state.selectedValues, ["blocked", "unknown"]);
	assert.deepEqual(state.addOptions, ["delegated", "work"]);
	assert.deepEqual(state.unknownSelectedValues, ["unknown"]);
});

void test("multiselect editor can remove the last selected value", () => {
	assert.deepEqual(removeMultiSelectEditorValue(["blocked"], "blocked"), []);
	assert.deepEqual(removeMultiSelectEditorValue(["blocked", "delegated"], "blocked"), ["delegated"]);
});

function makeMultiSelectProperty(
	options: Array<{id: string; value: string; color: string}>,
): ProjectPropertyDefinition {
	return {
		id: "attributes",
		name: "attributes",
		label: "Attributes",
		type: "list",
		render: "multiselect",
		icon: "",
		labelMode: "name",
		min: 0,
		max: 100,
		step: 5,
		options,
		optionsColored: true,
	};
}
