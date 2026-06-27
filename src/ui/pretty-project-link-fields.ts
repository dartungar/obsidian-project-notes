import {getProjectPropertyById, isProjectPropertyEmpty} from "../project-properties";
import type {ProjectInfo} from "../project-metadata";
import type {SimpleProjectViewsSettings} from "../settings";

export function getPrettyLinkVisibleFields(
	settings: SimpleProjectViewsSettings,
	project: ProjectInfo,
): string[] {
	return settings.prettyLinkFields.filter((field) => {
		if (field === "status") {
			return true;
		}

		const property = getProjectPropertyById(project.properties, field);
		return property !== null && !isProjectPropertyEmpty(property);
	});
}
