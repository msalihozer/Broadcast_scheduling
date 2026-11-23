import { useState, useEffect } from 'react';

/**
 * Shared responsive breakpoint hook across all modules and Admin Panel.
 * - isMobile: <= 768px (phones / narrow viewports)
 * - isCompact: <= 960px (phones + small tablets where fixed sidebars / 3-col headers must collapse)
 * - isTablet: <= 1024px
 */
export function useResponsive() {
    const getState = () => {
        if (typeof window === 'undefined') {
            return { width: 1440, isMobile: false, isCompact: false, isTablet: false };
        }
        const width = window.innerWidth;
        return {
            width,
            isMobile: width <= 768,
            isCompact: width <= 960,
            isTablet: width <= 1024,
        };
    };

    const [state, setState] = useState(getState);

    useEffect(() => {
        const handleResize = () => {
            setState(getState());
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return state;
}

export default useResponsive;
