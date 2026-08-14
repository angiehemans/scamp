/**
 * Switch a just-imported image over to its compressed version.
 *
 * Large imports are placed immediately from the copied original and
 * converted in the background, so the canvas doesn't sit empty for
 * several seconds. When the conversion lands, every reference moves to
 * the `.webp` — silently, since the user didn't perform this edit.
 *
 * Main is told whether the swap applied, because it can't safely delete
 * the now-unreferenced file until it knows which one that is. Nothing is
 * deleted if we never answer (window closed, project switched): the
 * project keeps a redundant file, which is wasteful but never broken.
 * see docs/plans/image-import-speed-plan.md
 */
export declare const useOptimizedImageSwap: () => void;
