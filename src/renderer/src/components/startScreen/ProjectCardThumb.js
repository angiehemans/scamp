import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import styles from './ProjectCardThumb.module.css';
export const ProjectCardThumb = ({ projectPath, hasThumbnail, background, }) => {
    const [base64, setBase64] = useState(null);
    useEffect(() => {
        if (!hasThumbnail) {
            setBase64(null);
            return;
        }
        let cancelled = false;
        void window.scamp
            .readProjectThumbnail({ projectPath })
            .then((result) => {
            if (!cancelled)
                setBase64(result.base64);
        })
            .catch(() => {
            // A thumbnail that will not load is not worth surfacing — the
            // placeholder is a perfectly good card.
            if (!cancelled)
                setBase64(null);
        });
        return () => {
            cancelled = true;
        };
    }, [projectPath, hasThumbnail]);
    return (_jsx("span", { className: styles.thumb, "data-testid": "project-card-thumb", style: background !== undefined ? { background } : undefined, children: base64 !== null && (_jsx("img", { className: styles.image, src: `data:image/png;base64,${base64}`, alt: "" })) }));
};
