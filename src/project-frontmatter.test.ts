/* eslint-disable import/no-nodejs-modules */
import test from "node:test";
import assert from "node:assert/strict";
import {repairDuplicateYamlBlocks, updatePropertyInMarkdown} from "./project-frontmatter";

void test("replaces nested YAML property blocks with a scalar", () => {
	const content = [
		"---",
		"status:",
		"  - todo",
		"tags:",
		"  - project",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = updatePropertyInMarkdown(content, "status", "done");

	assert.equal(updated, [
		"---",
		"status: done",
		"tags:",
		"  - project",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("does not edit YAML-like blocks outside top frontmatter", () => {
	const content = [
		"# Project",
		"",
		"---",
		"status: todo",
		"---",
		"",
	].join("\n");

	const updated = updatePropertyInMarkdown(content, "status", "done");

	assert.equal(updated, [
		"---",
		"status: done",
		"---",
		"# Project",
		"",
		"---",
		"status: todo",
		"---",
		"",
	].join("\n"));
});

void test("repairs only adjacent top YAML blocks", () => {
	const content = [
		"---",
		"icon: folder-kanban",
		"---",
		"",
		"---",
		"status: todo",
		"---",
		"Body",
		"",
	].join("\n");

	const repaired = repairDuplicateYamlBlocks(content);

	assert.equal(repaired, [
		"---",
		"status: todo",
		"icon: folder-kanban",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("leaves later YAML-like blocks alone during duplicate repair", () => {
	const content = [
		"---",
		"status: todo",
		"---",
		"# Project",
		"",
		"---",
		"note: not frontmatter",
		"---",
		"",
	].join("\n");

	assert.equal(repairDuplicateYamlBlocks(content), content);
});
