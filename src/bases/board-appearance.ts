export type BoardCardLayout = "compact" | "default" | "spacious";

export function normalizeColorfulBoard(value: unknown): boolean {
	return value === true;
}

export function normalizeBoardCardLayout(value: unknown): BoardCardLayout {
	return value === "compact" || value === "spacious" ? value : "default";
}

export function getBoardClassName(colorfulBoard: boolean, cardLayout: BoardCardLayout): string {
	return [
		"spv-board",
		colorfulBoard ? "spv-board-colorful" : "",
		`spv-board-card-layout-${cardLayout}`,
	]
		.filter((className) => className.length > 0)
		.join(" ");
}
