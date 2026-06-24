export function normalizeShowTableColumnDividers(value: unknown): boolean {
	return value !== false;
}

export function getProjectTableClassName(showColumnDividers: boolean): string {
	return showColumnDividers
		? "spv-project-table spv-project-table-column-dividers"
		: "spv-project-table";
}
