import { useRef } from 'react';
/**
 * Holds the latest render's `value` in a stable ref. Lets a globally-
 * bound effect (keydown listener, one-shot navigation consumer) read
 * the current closure values without listing them as deps — so the
 * listener binds once instead of re-binding on every change, and we
 * drop the `exhaustive-deps` suppressions. Written during render (not
 * in an effect) so an effect that reads `.current` synchronously sees
 * this render's value even when it's declared before this ref.
 */
export const useLatest = (value) => {
    const ref = useRef(value);
    ref.current = value;
    return ref;
};
