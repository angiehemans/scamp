import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
export const useColorPickerContext = () => {
    const projectColors = useCanvasStore(selectProjectColors);
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const openThemePanel = useCanvasStore((s) => s.openThemePanel);
    return {
        presetColors: projectColors.length > 0 ? projectColors : undefined,
        themeTokens,
        onOpenTheme: openThemePanel ?? undefined,
    };
};
