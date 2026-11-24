import { useEffect, useState } from 'react';

// Lebar elemen (px) - dikemas kini apabila skrin diputar/diubah saiz.
// Digunakan oleh Pratonton OPR untuk "muat lebar" PDF pada skrin telefon.
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => setWidth(Math.floor(el.clientWidth));

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
    // Fallback pelayar lama tanpa ResizeObserver.
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [ref]);

  return width;
}
