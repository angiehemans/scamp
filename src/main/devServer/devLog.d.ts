/**
 * One line of `scamp dev --json` (scampjs CONTRACT.md section 2.1) as the
 * app log shows it, or null for a line that isn't one: the readiness
 * line, or Vite's own output.
 */
export declare const parseDevJsonLine: (line: string) => {
    level: "info" | "error";
    message: string;
} | null;
