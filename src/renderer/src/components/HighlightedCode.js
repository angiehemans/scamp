import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { firstLine } from '@lib/codeHighlight';
import styles from './HighlightedCode.module.css';
const READ_ONLY = EditorView.editable.of(false);
const lineMark = Decoration.line({ class: styles.highlightLine ?? '' });
const setRanges = StateEffect.define();
/**
 * Holds the highlight decorations.
 *
 * A StateField rather than a rebuilt extension array: reconfiguring the
 * editor on every selection change would reset scroll position and fold
 * state, which is exactly what the user is trying to keep hold of.
 */
const highlightField = StateField.define({
    create: () => Decoration.none,
    update: (deco, tr) => {
        for (const effect of tr.effects) {
            if (!effect.is(setRanges))
                continue;
            const marks = [];
            for (const range of effect.value) {
                // The document can be shorter than the ranges for one render after
                // an external edit — clamp rather than throw.
                const last = tr.state.doc.lines;
                for (let n = range.from; n <= Math.min(range.to, last); n += 1) {
                    if (n < 1)
                        continue;
                    marks.push(lineMark.range(tr.state.doc.line(n).from));
                }
            }
            return Decoration.set(marks, true);
        }
        return tr.docChanged ? deco.map(tr.changes) : deco;
    },
    provide: (field) => EditorView.decorations.from(field),
});
export const HighlightedCode = ({ value, language, ranges, theme, }) => {
    const viewRef = useRef(null);
    useEffect(() => {
        const view = viewRef.current;
        if (view === null)
            return;
        view.dispatch({ effects: setRanges.of(ranges) });
        const line = firstLine(ranges);
        if (line === null || line > view.state.doc.lines)
            return;
        view.dispatch({
            effects: EditorView.scrollIntoView(view.state.doc.line(line).from, {
                // Centring beats `nearest` here: the element's rule usually has
                // context above and below worth seeing.
                y: 'center',
            }),
        });
        // `value` is a dependency because the ranges refer to line numbers in a
        // specific document — re-applying after the source changes keeps the
        // highlight on the right lines.
    }, [ranges, value]);
    return (_jsx(CodeMirror, { value: value, height: "100%", theme: theme, extensions: [language, READ_ONLY, highlightField], basicSetup: {
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: false,
        }, onCreateEditor: (view) => {
            viewRef.current = view;
            // The editor mounts after the first effect run, so apply once here
            // too — otherwise opening the panel with something already selected
            // shows no highlight until the next selection change.
            view.dispatch({ effects: setRanges.of(ranges) });
            const line = firstLine(ranges);
            if (line !== null && line <= view.state.doc.lines) {
                view.dispatch({
                    effects: EditorView.scrollIntoView(view.state.doc.line(line).from, {
                        y: 'center',
                    }),
                });
            }
        } }));
};
