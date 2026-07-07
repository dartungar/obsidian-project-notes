/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import {appendPropertyListItemInMarkdown, repairDuplicateYamlBlocks, updatePropertyInMarkdown} from "./project-frontmatter";

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

void test("appends a list property to markdown without frontmatter", () => {
	const content = "# Parent\n";

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child A]]");

	assert.equal(updated, [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"---",
		"# Parent",
		"",
	].join("\n"));
});

void test("appends to an existing YAML list property", () => {
	const content = [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child B]]");

	assert.equal(updated, [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"  - \"[[Projects/Child B]]\"",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("does not append duplicate list values", () => {
	const content = [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child A]]");

	assert.equal(updated, content);
});

void test("replaces scalar children value with a list when appending", () => {
	const content = [
		"---",
		"children: \"[[Projects/Child A]]\"",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = appendPropertyListItemInMarkdown(content, "children", "[[Projects/Child B]]");

	assert.equal(updated, [
		"---",
		"children:",
		"  - \"[[Projects/Child A]]\"",
		"  - \"[[Projects/Child B]]\"",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("writes a list property to markdown without frontmatter", () => {
	const updated = updatePropertyInMarkdown("# Project\n", "areas", ["Ops", "Design"]);

	assert.equal(updated, [
		"---",
		"areas:",
		"  - Ops",
		"  - Design",
		"---",
		"# Project",
		"",
	].join("\n"));
});

void test("replaces a scalar property with a list property", () => {
	const content = [
		"---",
		"areas: Ops",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = updatePropertyInMarkdown(content, "areas", ["Ops", "Design"]);

	assert.equal(updated, [
		"---",
		"areas:",
		"  - Ops",
		"  - Design",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("replaces a list property with a new list property", () => {
	const content = [
		"---",
		"areas:",
		"  - Ops",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = updatePropertyInMarkdown(content, "areas", ["Design"]);

	assert.equal(updated, [
		"---",
		"areas:",
		"  - Design",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("removes a list property when the next list is empty", () => {
	const content = [
		"---",
		"areas:",
		"  - Ops",
		"title: Apollo",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = updatePropertyInMarkdown(content, "areas", []);

	assert.equal(updated, [
		"---",
		"title: Apollo",
		"---",
		"Body",
		"",
	].join("\n"));
});

void test("removes a property when the next value is null", () => {
	const content = [
		"---",
		"areas:",
		"  - Ops",
		"title: Apollo",
		"---",
		"Body",
		"",
	].join("\n");

	const updated = updatePropertyInMarkdown(content, "areas", null);

	assert.equal(updated, [
		"---",
		"title: Apollo",
		"---",
		"Body",
		"",
	].join("\n"));
});
