/* eslint-disable import/no-nodejs-modules -- Node test files import built-in test/assert modules. */
import test from "node:test";
import assert from "node:assert/strict";
import SimpleProjectViewsPlugin from "./main";

type CreateChildProject = SimpleProjectViewsPlugin["createChildProject"];
const __createChildProjectTypeCheck: CreateChildProject | null = null;
void __createChildProjectTypeCheck;

void test("unload tolerates load failures before toolbar setup", () => {
	const plugin = Object.create(SimpleProjectViewsPlugin.prototype) as SimpleProjectViewsPlugin;

	assert.doesNotThrow(() => plugin.onunload());
});
