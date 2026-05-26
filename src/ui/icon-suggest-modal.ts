import {App, getIconIds, setIcon, SuggestModal} from "obsidian";

const ICON_SUGGESTION_LIMIT = 50;
const PREFERRED_PROJECT_ICONS = [
	"folder-kanban",
	"folder",
	"briefcase-business",
	"clipboard-list",
	"list-checks",
	"kanban",
	"target",
	"rocket",
	"book-open",
	"hammer",
	"wrench",
	"package",
	"calendar-check",
	"flag",
	"star",
	"landmark",
	"lightbulb",
	"palette",
	"code-xml",
	"bug",
	"megaphone",
	"users",
	"home",
	"heart",
	"music",
	"camera",
	"graduation-cap",
	"sprout",
];

export class ProjectIconSuggestModal extends SuggestModal<string> {
	private readonly icons: string[];

	constructor(
		app: App,
		private readonly currentIcon: string,
		private readonly onChoose: (icon: string) => Promise<void>,
	) {
		super(app);
		this.icons = getProjectIconOptions(currentIcon);
		this.setPlaceholder("Search icons");
	}

	getSuggestions(query: string): string[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return this.icons.slice(0, ICON_SUGGESTION_LIMIT);
		}

		return this.icons
			.filter((icon) => icon.toLowerCase().includes(normalizedQuery))
			.slice(0, ICON_SUGGESTION_LIMIT);
	}

	renderSuggestion(icon: string, el: HTMLElement): void {
		const suggestionEl = el.createDiv({cls: "spv-icon-suggestion"});
		const iconEl = suggestionEl.createSpan({
			cls: "spv-project-icon spv-icon-suggestion-preview",
			attr: {"aria-hidden": "true"},
		});
		setIcon(iconEl, icon);
		suggestionEl.createSpan({cls: "spv-icon-suggestion-name", text: icon});

		if (icon === this.currentIcon) {
			const currentEl = suggestionEl.createSpan({cls: "spv-icon-suggestion-current", text: "Current"});
			currentEl.setAttribute("aria-label", "Current project icon");
		}
	}

	onChooseSuggestion(icon: string): void {
		void this.onChoose(icon);
	}
}

function getProjectIconOptions(currentIcon: string): string[] {
	const iconIds = getIconIds().sort((a, b) => a.localeCompare(b));
	const availableIcons = new Set(iconIds);
	const preferredIcons = PREFERRED_PROJECT_ICONS.filter((icon) => availableIcons.has(icon));

	return unique([
		...(currentIcon ? [currentIcon] : []),
		...preferredIcons,
		...iconIds,
	]);
}

function unique(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const value of values) {
		if (seen.has(value)) {
			continue;
		}

		seen.add(value);
		result.push(value);
	}

	return result;
}
