import type {MarkdownPostProcessorContext} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {renderPrettyProjectLink, resolvePrettyProjectLink} from "./pretty-project-link-renderer";

const PROCESSED_ATTR = "data-spv-pretty-project-link-processed";

export function registerPrettyProjectLinks(plugin: SimpleProjectViewsPlugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		renderPrettyProjectLinksInReadingView(plugin, el, ctx);
	});
}

function renderPrettyProjectLinksInReadingView(
	plugin: SimpleProjectViewsPlugin,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): void {
	if (!plugin.settings.prettyLinksEnabled) {
		return;
	}

	for (const linkEl of Array.from(el.querySelectorAll<HTMLAnchorElement>("a.internal-link"))) {
		if (linkEl.getAttribute(PROCESSED_ATTR) === "true") {
			continue;
		}

		linkEl.setAttribute(PROCESSED_ATTR, "true");
		const linktext = linkEl.getAttribute("data-href") ?? linkEl.getAttribute("href") ?? "";
		if (!linktext) {
			continue;
		}

		const data = resolvePrettyProjectLink(plugin, linktext, ctx.sourcePath, linkEl.textContent ?? "");
		if (!data) {
			continue;
		}

		const wrapperEl = linkEl.ownerDocument.createElement("span");
		renderPrettyProjectLink(wrapperEl, plugin, data);
		const prettyLinkEl = wrapperEl.firstElementChild;
		if (prettyLinkEl) {
			linkEl.replaceWith(prettyLinkEl);
		}
	}
}
