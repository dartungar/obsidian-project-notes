import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import type {renderProjectRelationships} from "./project-relationship-controls";

type RenderProjectRelationships = typeof renderProjectRelationships;
const __renderProjectRelationshipsTypeCheck: RenderProjectRelationships = (
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
) => {
	void containerEl;
	void plugin;
	void project;
};
void __renderProjectRelationshipsTypeCheck;
