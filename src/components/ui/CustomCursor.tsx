import React, { useEffect, useRef } from 'react';

/**
 * Modern ultra-responsive custom cursor for fine-pointer desktop devices.
 * - Rendered unconditionally with z-[9999] so refs are never null on mount.
 * - Smart fine-pointer detection: supports hybrid/touchscreen laptops with mouse/trackpad.
 * - Zero-delay instant primary tracking directly on mousemove.
 * - Snappy high-frequency outer halo follower (lerp: 0.52).
 * - Separated transform containers: zero CSS transition fighting rAF coordinates.
 * - Non-blocking (pointer-events: none), respects prefers-reduced-motion, touch-safe.
 */
export function CustomCursor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const dotInnerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const ringInnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Disable only on strictly touch-only devices (e.g., phones with no mouse/trackpad)
    const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouchOnly || prefersReducedMotion) {
      if (containerRef.current) {
        containerRef.current.style.display = 'none';
      }
      return;
    }

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isHovering = false;
    let isPressed = false;
    let rafId: number;

    const showCursor = () => {
      if (containerRef.current && containerRef.current.style.opacity !== '1') {
        containerRef.current.style.opacity = '1';
      }
    };

    const hideCursor = () => {
      if (containerRef.current) {
        containerRef.current.style.opacity = '0';
      }
    };

    const updateInnerStyles = () => {
      if (ringInnerRef.current) {
        if (isPressed) {
          ringInnerRef.current.className =
            'w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-600 bg-indigo-600/25 scale-90 transition-all duration-75 ease-out';
        } else if (isHovering) {
          ringInnerRef.current.className =
            'w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-500 bg-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.35)] scale-100 transition-all duration-150 ease-out';
        } else {
          ringInnerRef.current.className =
            'w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-500/60 bg-indigo-500/10 scale-100 transition-all duration-150 ease-out';
        }
      }

      if (dotInnerRef.current) {
        if (isPressed) {
          dotInnerRef.current.className =
            'w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-700 scale-90 ring-2 ring-white transition-transform duration-75 ease-out';
        } else if (isHovering) {
          dotInnerRef.current.className =
            'w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 scale-75 ring-2 ring-white transition-transform duration-150 ease-out';
        } else {
          dotInnerRef.current.className =
            'w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 ring-2 ring-white shadow-[0_0_10px_rgba(79,70,229,0.7)] scale-100 transition-transform duration-150 ease-out';
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // INSTANT hardware-rate placement for dot (0 delay)
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }

      showCursor();

      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = !!target.closest(
          'a, button, [role="button"], input, select, textarea, .group, [data-interactive="true"]'
        );
        if (interactive !== isHovering) {
          isHovering = interactive;
          updateInnerStyles();
        }
      }
    };

    const onMouseDown = () => {
      isPressed = true;
      updateInnerStyles();
    };

    const onMouseUp = () => {
      isPressed = false;
      updateInnerStyles();
    };

    const onMouseLeave = () => {
      hideCursor();
    };

    const onMouseEnter = () => {
      showCursor();
    };

    const animate = () => {
      // High-frequency responsive follower (speed: 0.52 settles in 2 frames)
      const speed = 0.52;
      ringX += (mouseX - ringX) * speed;
      ringY += (mouseY - ringY) * speed;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden opacity-0 transition-opacity duration-150"
      aria-hidden="true"
    >
      {/* Outer Halo Follower (Snappy, responsive, zero-delay transform) */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 pointer-events-none will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        <div
          ref={ringInnerRef}
          className="w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-500/60 bg-indigo-500/10 transition-all duration-150 ease-out"
        />
      </div>

      {/* Central Solid Dot (Instant 1:1 hardware tracking) */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        <div
          ref={dotInnerRef}
          className="w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 ring-2 ring-white shadow-[0_0_10px_rgba(79,70,229,0.7)] transition-transform duration-150 ease-out"
        />
      </div>
    </div>
  );
}
