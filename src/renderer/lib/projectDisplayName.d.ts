/**
 * Project names come from folder names on disk, so they arrive slugified
 * — `my-project-name`, `my_project_name`. Presenting them as written
 * makes the start screen read like a directory listing rather than a
 * list of projects.
 *
 * This is display-only. The raw name still identifies the folder, so
 * every disk and IPC path must keep using `project.name` untouched.
 */
/**
 * Formats a slugified project name for display: `my-project-name`
 * becomes `My Project Name`.
 *
 * Returns the input unchanged when there is nothing to format, so a name
 * that is already prose ("My Project") survives untouched. Runs of
 * separators collapse, and leading/trailing ones are dropped.
 */
export declare const projectDisplayName: (name: string) => string;
