export type BoardCardLayout = "compact" | "default" | "spacious";
export type BoardColorMode = "plain" | "subtle" | "colorful";

export function normalizeColorfulBoard(value: unknown): boolean {
	return value === true;
}

export function normalizeBoardColorMode(value: unknown, legacyColorfulBoard: unknown): BoardColorMode {
	if (value === "plain" || value === "subtle" || value === "colorful") {
		return value;
	}

	return normalizeColorfulBoard(legacyColorfulBoard) ? "colorful" : "plain";
}

export function normalizeBoardCardLayout(value: unknown): BoardCardLayout {
	return value === "compact" || value === "spacious" ? value : "default";
}

export function getBoardClassName(colorMode: BoardColorMode | boolean, cardLayout: BoardCardLayout): string {
	const normalizedColorMode = typeof colorMode === "boolean"
		? normalizeBoardColorMode(undefined, colorMode)
		: normalizeBoardColorMode(colorMode, false);

	return [
		"spv-board",
		normalizedColorMode === "plain" ? "" : `spv-board-${normalizedColorMode}`,
		`spv-board-card-layout-${cardLayout}`,
	]
		.filter((className) => className.length > 0)
		.join(" ");
}
