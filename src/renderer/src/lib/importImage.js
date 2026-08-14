import { useCanvasStore } from '@store/canvasSlice';
/**
 * Import an image into the project, flagging the canvas as busy while it
 * converts.
 *
 * Every import path goes through here — the image tool, drag-and-drop,
 * Replace image, Set background image — so the indicator can't be wired
 * up in three places and forgotten in the fourth.
 * see docs/plans/image-import-speed-plan.md
 */
export const importImage = async (sourcePath, projectPath) => {
    const { setImageImportBusy } = useCanvasStore.getState();
    setImageImportBusy(true);
    try {
        return await window.scamp.copyImage({ sourcePath, projectPath });
    }
    finally {
        useCanvasStore.getState().setImageImportBusy(false);
    }
};
