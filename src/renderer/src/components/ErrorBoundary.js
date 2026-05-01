import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
/**
 * Catches rendering errors anywhere in the child tree and shows a
 * recovery UI instead of a blank screen. This is intentionally a class
 * component — React has no hook-based error boundary API.
 */
export class ErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] render crash:', error, info.componentStack);
    }
    handleReset = () => {
        this.setState({ error: null });
    };
    render() {
        if (this.state.error) {
            if (this.props.fallback)
                return this.props.fallback;
            return (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    gap: 16,
                    color: '#f5f5f7',
                    fontFamily: 'system-ui, sans-serif',
                    background: '#1a1a1a',
                    padding: 40,
                    textAlign: 'center',
                }, children: [_jsx("h2", { style: { margin: 0, fontSize: 20 }, children: "Something went wrong" }), _jsx("pre", { style: {
                            margin: 0,
                            padding: 16,
                            background: '#0a0a0a',
                            borderRadius: 8,
                            fontSize: 13,
                            maxWidth: 600,
                            overflow: 'auto',
                            color: '#ff6b6b',
                        }, children: this.state.error.message }), _jsx("button", { onClick: this.handleReset, style: {
                            padding: '8px 20px',
                            background: '#333',
                            color: '#f5f5f7',
                            border: '1px solid #555',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 14,
                        }, children: "Try again" })] }));
        }
        return this.props.children;
    }
}
