import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Restores expected scroll behaviour for client-side navigation:
 * new pages start at the top, and "#hash" links scroll to their target once it has rendered.
 */
export default function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    let attempts = 0;
    let timer = 0;
    const tryScroll = () => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
      // Lazy routes may still be loading; retry briefly.
      if (attempts++ < 20) timer = window.setTimeout(tryScroll, 50);
    };
    tryScroll();
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);

  return null;
}
