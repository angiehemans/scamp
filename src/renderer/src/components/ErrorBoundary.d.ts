import { Component, type ErrorInfo, type ReactNode } from 'react';
type Props = {
    children: ReactNode;
    fallback?: ReactNode;
};
type State = {
    error: Error | null;
};
/**
 * Catches rendering errors anywhere in the child tree and shows a
 * recovery UI instead of a blank screen. This is intentionally a class
 * component — React has no hook-based error boundary API.
 */
export declare class ErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    handleReset: () => void;
    render(): ReactNode;
}
export {};
