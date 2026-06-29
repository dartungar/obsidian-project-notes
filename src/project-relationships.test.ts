/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {readProjectRelationships} from "./project-relationships";
import {normalizeSettings} from "./settings";

void test("reads parent and children relationship links from configured properties", () => {
	const settings = normalizeSettings();

	const relationships = readProjectRelationships(settings, {
		parent: "[[Projects/Parent project]]",
		children: ["[[Projects/Child A]]", "[[Projects/Child B|Child B]]"],
	});

	assert.equal(relationships.parent?.target, "Projects/Parent project");
	assert.equal(relationships.parent?.display, "Parent project");
	assert.deepEqual(relationships.children.map((child) => child.target), [
		"Projects/Child A",
		"Projects/Child B",
	]);
	assert.deepEqual(relationships.children.map((child) => child.display), [
		"Child A",
		"Child B",
	]);
});

void test("reads children from scalar relationship value", () => {
	const settings = normalizeSettings();

	const relationships = readProjectRelationships(settings, {
		children: "[[Projects/Only child]]",
	});

	assert.equal(relationships.parent, null);
	assert.deepEqual(relationships.children.map((child) => child.target), ["Projects/Only child"]);
});

void test("skips empty or unsupported relationship values", () => {
	const settings = normalizeSettings();

	const relationships = readProjectRelationships(settings, {
		parent: " ",
		children: ["[[Projects/Child A]]", "", 123, null],
	});

	assert.equal(relationships.parent, null);
	assert.deepEqual(relationships.children.map((child) => child.target), ["Projects/Child A"]);
});
