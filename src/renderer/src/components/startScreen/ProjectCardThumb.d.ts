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
};
export declare const ProjectCardThumb: ({ projectPath, hasThumbnail, }: Props) => JSX.Element;
export {};
