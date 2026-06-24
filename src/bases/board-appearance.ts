export function normalizeColorfulBoard(value: unknown): boolean {
	return value === true;
}

export function getBoardClassName(colorfulBoard: boolean): string {
	return colorfulBoard ? "spv-board spv-board-colorful" : "spv-board";
}
