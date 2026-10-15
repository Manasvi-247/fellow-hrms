import { useCallback, useEffect, useRef, useState } from 'react';
import { nowParts } from './dates.js';

export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then(
        (data) => id === seq.current && setState({ data, error: null, loading: false }),
        (error) => id === seq.current && setState((s) => ({ data: s.data, error, loading: false })),
      );
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run };
}

const widthNow = () => (typeof window === 'undefined' ? 1440 : window.innerWidth);

export function useViewport() {
  const [vw, setVw] = useState(widthNow);
  useEffect(() => {
    const onResize = () => setVw(widthNow());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { vw, isMobile: vw < 640, isTablet: vw < 1100 };
}

export function useNow() {
  const [now, setNow] = useState(nowParts);
  useEffect(() => {
    const t = setInterval(() => setNow(nowParts()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
