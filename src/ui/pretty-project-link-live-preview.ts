import {RangeSetBuilder, StateEffect} from "@codemirror/state";
import type {Extension} from "@codemirror/state";
import {Decoration, EditorView, ViewPlugin, WidgetType} from "@codemirror/view";
import type {DecorationSet, ViewUpdate} from "@codemirror/view";
import {editorInfoField, editorLivePreviewField} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {renderPrettyProjectLink, resolvePrettyProjectLink} from "./pretty-project-link-renderer";
import type {PrettyProjectLinkData} from "./pretty-project-link-renderer";

const WIKI_LINK_REGEX = /!?\[\[([^\]\n]+)\]\]/g;
const prettyProjectLinkRefreshEffect = StateEffect.define<void>();
const livePreviewViews = new Set<EditorView>();

export function trackPrettyProjectLinkLivePreviewView(view: EditorView): void {
	livePreviewViews.add(view);
}

export function untrackPrettyProjectLinkLivePreviewView(view: EditorView): void {
	livePreviewViews.delete(view);
}

export function refreshPrettyProjectLinkLivePreviewEditors(): void {
	for (const view of livePreviewViews) {
		view.dispatch({
			effects: prettyProjectLinkRefreshEffect.of(),
		});
	}
}

export function hasPrettyProjectLinkRefreshEffect(update: ViewUpdate): boolean {
	return update.transactions.some((transaction) => {
		return transaction.effects.some((effect) => effect.is(prettyProjectLinkRefreshEffect));
	});
}

export function createPrettyProjectLinkLivePreviewExtension(plugin: SimpleProjectViewsPlugin): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;

		constructor(private readonly view: EditorView) {
			trackPrettyProjectLinkLivePreviewView(view);
			this.decorations = this.buildDecorations();
		}

		update(update: ViewUpdate): void {
			const isPrettyLinkRefresh = hasPrettyProjectLinkRefreshEffect(update);
			if (update.docChanged || update.viewportChanged || update.selectionSet || isPrettyLinkRefresh) {
				this.decorations = this.buildDecorations({renderSelectedLinks: isPrettyLinkRefresh});
			}
		}

		destroy(): void {
			untrackPrettyProjectLinkLivePreviewView(this.view);
		}

		private buildDecorations(options: {renderSelectedLinks: boolean} = {renderSelectedLinks: false}): DecorationSet {
			if (!plugin.settings.prettyLinksEnabled || !this.view.state.field(editorLivePreviewField, false)) {
				return Decoration.none;
			}

			const sourcePath = getSourcePath(this.view);
			if (!sourcePath) {
				return Decoration.none;
			}

			const builder = new RangeSetBuilder<Decoration>();
			for (const range of this.view.visibleRanges) {
				const text = this.view.state.doc.sliceString(range.from, range.to);
				WIKI_LINK_REGEX.lastIndex = 0;
				let match: RegExpExecArray | null;
				while ((match = WIKI_LINK_REGEX.exec(text)) !== null) {
					const matchedText = match[0];
					if (matchedText.startsWith("!")) {
						continue;
					}

					const from = range.from + match.index;
					const to = from + matchedText.length;
					if (!shouldRenderPrettyProjectLinkRange(this.view, from, to, options.renderSelectedLinks)) {
						continue;
					}

					const linkBody = match[1] ?? "";
					const [linktext, alias] = splitLinkAlias(linkBody);
					const data = resolvePrettyProjectLink(plugin, linktext, sourcePath, alias);
					if (!data) {
						continue;
					}

					builder.add(from, to, Decoration.replace({
						widget: new PrettyProjectLinkWidget(plugin, data),
						inclusive: false,
					}));
				}
			}

			return builder.finish();
		}
	}, {
		decorations: (value) => value.decorations,
	});
}

export function shouldRenderPrettyProjectLinkRange(
	view: EditorView,
	from: number,
	to: number,
	renderSelectedLinks: boolean,
): boolean {
	return renderSelectedLinks || !selectionIntersects(view, from, to);
}

export function shouldIgnorePrettyProjectLinkWidgetEvent(_event: Event): boolean {
	return true;
}

class PrettyProjectLinkWidget extends WidgetType {
	private readonly signature: string;

	constructor(
		private readonly plugin: SimpleProjectViewsPlugin,
		private readonly data: PrettyProjectLinkData,
	) {
		super();
		this.signature = getProjectSignature(data.project, plugin.settings.prettyLinkFields);
	}

	toDOM(view: EditorView): HTMLElement {
		const wrapperEl = view.dom.ownerDocument.createElement("span");
		renderPrettyProjectLink(wrapperEl, this.plugin, this.data);
		return wrapperEl.firstElementChild as HTMLElement;
	}

	eq(other: PrettyProjectLinkWidget): boolean {
		return this.data.file.path === other.data.file.path
			&& this.data.label === other.data.label
			&& this.signature === other.signature;
	}

	ignoreEvent(event: Event): boolean {
		return shouldIgnorePrettyProjectLinkWidgetEvent(event);
	}
}

function getSourcePath(view: EditorView): string {
	const info = view.state.field(editorInfoField, false);
	return info?.file?.path ?? "";
}

function splitLinkAlias(value: string): [string, string] {
	const pipeIndex = value.indexOf("|");
	if (pipeIndex === -1) {
		return [value, ""];
	}

	return [value.slice(0, pipeIndex), value.slice(pipeIndex + 1)];
}

function selectionIntersects(view: EditorView, from: number, to: number): boolean {
	return view.state.selection.ranges.some((range) => range.from < to && range.to > from);
}

function getProjectSignature(project: ProjectInfo, fields: string[]): string {
	const values = fields.map((field) => {
		if (field === "status") {
			return `status:${project.status}`;
		}

		const property = project.properties.find((candidate) => candidate.definition.id === field);
		return `${field}:${property?.value ?? ""}:${property?.numberValue ?? ""}`;
	});

	return [
		project.title,
		project.icon,
		...values,
	].join("\u0000");
}
