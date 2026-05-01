import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css as cssLang } from '@codemirror/lang-css';
import { autocompletion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { useCanvasStore } from '@store/canvasSlice';
import { breakpointOverrideLines, classNameFor, elementDeclarationLines, } from '@lib/generateCode';
import { createCssCompletion } from '@lib/cssCompletion';
import { DESKTOP_BREAKPOINT_ID } from '@shared/types';
import { savePatch } from '../syncBridge';
import styles from './PropertiesPanel.module.css';
const buildClassBody = (el, parent) => {
    return elementDeclarationLines(el, parent).join('\n');
};
const buildBreakpointBody = (el, breakpointId) => {
    const override = el.breakpointOverrides?.[breakpointId];
    if (!override)
        return '';
    return breakpointOverrideLines(override, el).join('\n');
};
/**
 * The raw CSS editor view of the properties panel. Scopes its body
 * to the active breakpoint: at desktop it shows the base class's
 * declarations; at any other breakpoint it shows just the overrides
 * that would land in that @media block. Commits route through
 * `savePatch` with the matching `media` scope.
 */
export const CssPanel = () => {
    // Multi-select: the panel always edits the FIRST selected element so the
    // user has a single, predictable target. The other selected elements
    // still highlight on the canvas — they're just not editable here.
    const selectedId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
    const element = useCanvasStore((s) => {
        const id = s.selectedElementIds[0];
        return id ? s.elements[id] : undefined;
    });
    const parentElement = useCanvasStore((s) => {
        const id = s.selectedElementIds[0];
        const el = id ? s.elements[id] : undefined;
        if (!el || !el.parentId)
            return null;
        return s.elements[el.parentId] ?? null;
    });
    const activePage = useCanvasStore((s) => s.activePage);
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
    const breakpoints = useCanvasStore((s) => s.breakpoints);
    const activeBreakpoint = useMemo(() => breakpoints.find((b) => b.id === activeBreakpointId), [breakpoints, activeBreakpointId]);
    const isDesktop = activeBreakpointId === DESKTOP_BREAKPOINT_ID;
    // Rebuild CodeMirror extensions when theme tokens change so the
    // autocomplete source always has the latest var(--name) suggestions.
    const cssExtensions = useMemo(() => [
        cssLang(),
        autocompletion({
            override: [createCssCompletion(() => themeTokens)],
            activateOnTyping: true,
            closeOnBlur: true,
        }),
    ], [themeTokens]);
    const editorBody = useMemo(() => {
        if (!element)
            return '';
        if (isDesktop)
            return buildClassBody(element, parentElement);
        return buildBreakpointBody(element, activeBreakpointId);
    }, [element, parentElement, isDesktop, activeBreakpointId]);
    const [draft, setDraft] = useState(editorBody);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(null);
    const lastSelectedId = useRef(null);
    const lastBreakpointId = useRef(activeBreakpointId);
    // ---- Refs that escape React's render closures -------------------------
    // The blur-driven commit path runs AFTER the panel has re-rendered with
    // the next selection, so reading state via render-time closures gives
    // the wrong target. We mirror everything commit() needs into refs that
    // only update when we deliberately load a new edit target.
    const dirtyRef = useRef(false);
    useEffect(() => {
        dirtyRef.current = dirty;
    }, [dirty]);
    const draftRef = useRef('');
    useEffect(() => {
        draftRef.current = draft;
    }, [draft]);
    const editTargetRef = useRef(null);
    const flushDraft = async () => {
        const target = editTargetRef.current;
        if (!target)
            return;
        if (!dirtyRef.current)
            return;
        try {
            await savePatch({
                cssPath: target.cssPath,
                className: target.className,
                newDeclarations: draftRef.current,
                ...(target.media ? { media: target.media } : {}),
            });
            setDirty(false);
            dirtyRef.current = false;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };
    // Reload the draft when the selection, the active breakpoint, or
    // the underlying element changes — but never when only the local
    // dirty/error flags flip. The dirty ref gates whether we overwrite
    // an in-progress edit; selection or breakpoint changes flush any
    // pending edit to the OLD target first.
    useEffect(() => {
        const selectionChanged = lastSelectedId.current !== selectedId;
        const breakpointChanged = lastBreakpointId.current !== activeBreakpointId;
        const switchingContext = selectionChanged || breakpointChanged;
        if (switchingContext) {
            if (dirtyRef.current && editTargetRef.current) {
                void flushDraft();
            }
            lastSelectedId.current = selectedId;
            lastBreakpointId.current = activeBreakpointId;
            setDraft(editorBody);
            setDirty(false);
            dirtyRef.current = false;
            setError(null);
            if (element && activePage) {
                editTargetRef.current = {
                    className: classNameFor(element),
                    cssPath: activePage.cssPath,
                    ...(activeBreakpoint && !isDesktop
                        ? { media: { maxWidth: activeBreakpoint.width } }
                        : {}),
                };
            }
            else {
                editTargetRef.current = null;
            }
            return;
        }
        // Same context — sync the draft from the parsed round-trip if the
        // user hasn't started typing yet.
        if (!dirtyRef.current) {
            setDraft(editorBody);
        }
        if (element && activePage) {
            editTargetRef.current = {
                className: classNameFor(element),
                cssPath: activePage.cssPath,
                ...(activeBreakpoint && !isDesktop
                    ? { media: { maxWidth: activeBreakpoint.width } }
                    : {}),
            };
        }
        // We deliberately don't depend on `element`/`activePage` directly:
        // editorBody already changes whenever the element does.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorBody, selectedId, activeBreakpointId]);
    if (!element || !selectedId)
        return _jsx(_Fragment, {});
    const handleKeyDown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            void flushDraft();
        }
    };
    const hintSuffix = isDesktop
        ? `Cmd/Ctrl+S or click outside to commit. Your edit writes to .module.css; the canvas reloads from the file.`
        : `Editing ${activeBreakpoint?.label ?? activeBreakpointId} (@media max-width: ${activeBreakpoint?.width ?? '?'}px). Commit writes inside that media block.`;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.editorWrap, onBlur: () => void flushDraft(), onKeyDown: handleKeyDown, children: _jsx(CodeMirror, { value: draft, height: "100%", theme: oneDark, extensions: cssExtensions, basicSetup: {
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        autocompletion: true,
                        bracketMatching: true,
                        closeBrackets: true,
                    }, onChange: (value) => {
                        setDraft(value);
                        setDirty(true);
                    } }) }), error && _jsx("div", { className: styles.error, children: error }), _jsx("div", { className: styles.hint, children: hintSuffix })] }));
};
