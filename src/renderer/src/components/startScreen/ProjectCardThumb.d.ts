/**
 * The image area at the top of a start-screen project card.
 *
 * Loads `.scamp/preview.png` for its own project, like
 * `ComponentSidebarItem` does for components. When there is no thumbnail
 * — a project not saved since this shipped, or one cloned from elsewhere,
 * since `.scamp/` is gitignored — the area stays empty and the card's
 * `cardBackground` shows through. The block keeps its height either way so
 * the grid stays even.
 *
 * see docs/notes/project-thumbnails.md
 */
type Props = {
    projectPath: string;
    /** From the projects list, so a card with none never flashes an image in. */
    hasThumbnail: boolean;
    /**
     * The project's `cardBackground`, used as the fill when there is no
     * screenshot yet. It tints this block only — not the whole card — so the
     * title, status and path keep the contrast the design gives them.
     */
    background?: string;
};
export declare const ProjectCardThumb: ({ projectPath, hasThumbnail, background, }: Props) => JSX.Element;
export {};
