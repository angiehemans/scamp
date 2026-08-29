/**
 * Project names come from folder names on disk, so they arrive slugified
 * — `my-project-name`, `my_project_name`. Presenting them as written
 * makes the start screen read like a directory listing rather than a
 * list of projects.
 *
 * This is display-only. The raw name still identifies the folder, so
 * every disk and IPC path must keep using `project.name` untouched.
 */
/** Word separators in a slug. Dots are excluded: `v1.2` is one word. */
const SEPARATORS = /[-_\s]+/;
/**
 * Capitalises the first character and leaves the rest of the word alone,
 * so an intentional `API` survives as `API` instead of flattening to
 * `Api`. The cost is that an all-lowercase `ui` becomes `Ui` — a wrong
 * guess either way, and this one at least never destroys information
 * the user typed.
 */
const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);
/**
 * Formats a slugified project name for display: `my-project-name`
 * becomes `My Project Name`.
 *
 * Returns the input unchanged when there is nothing to format, so a name
 * that is already prose ("My Project") survives untouched. Runs of
 * separators collapse, and leading/trailing ones are dropped.
 */
export const projectDisplayName = (name) => {
    const words = name.split(SEPARATORS).filter((word) => word.length > 0);
    if (words.length === 0)
        return name;
    return words.map(capitalise).join(' ');
};
