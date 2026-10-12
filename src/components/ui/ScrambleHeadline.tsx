import React, { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { useReducedMotion } from 'motion/react';

// Register GSAP plugin in browser environments
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrambleTextPlugin);
}

// Sophisticated enterprise character set (alphanumeric + clean tech symbols)
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*';

interface ScrambleHeadlineProps {
  className?: string;
}

export function ScrambleHeadline({ className }: ScrambleHeadlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const line3aRef = useRef<HTMLSpanElement>(null);
  const line3bRef = useRef<HTMLSpanElement>(null);

  const shouldReduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    // If reduced motion is requested, do not run the scramble animation
    if (shouldReduceMotion) return;

    const line1 = line1Ref.current;
    const line2 = line2Ref.current;
    const line3a = line3aRef.current;
    const line3b = line3bRef.current;

    if (!line1 || !line2 || !line3a || !line3b) return;

    // Reset initial text for clean typed/decoded entrance
    line1.textContent = '';
    line2.textContent = '';
    line3a.textContent = '';
    line3b.textContent = '';

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        delay: 0.18, // 180ms initial entrance delay
        onComplete: () => {
          // Guarantee exact final stable text upon completion
          line1.textContent = 'Recruitment, connected';
          line2.textContent = 'from first application';
          line3a.textContent = 'to ';
          line3b.textContent = 'final decision.';
        },
      });

      // Line 1: "Recruitment, connected"
      tl.to(line1, {
        duration: 1.25,
        scrambleText: {
          text: 'Recruitment, connected',
          chars: SCRAMBLE_CHARS,
          speed: 0.35,
          revealDelay: 0.22,
          tweenLength: true,
        },
        ease: 'power2.out',
      });

      // Line 2: "from first application" (progressive overlap)
      tl.to(
        line2,
        {
          duration: 1.25,
          scrambleText: {
            text: 'from first application',
            chars: SCRAMBLE_CHARS,
            speed: 0.35,
            revealDelay: 0.22,
            tweenLength: true,
          },
          ease: 'power2.out',
        },
        '-=0.75' // Gracefully overlaps as line 1 is resolving
      );

      // Line 3a: "to "
      tl.to(
        line3a,
        {
          duration: 0.45,
          scrambleText: {
            text: 'to ',
            chars: SCRAMBLE_CHARS,
            speed: 0.35,
            revealDelay: 0.08,
            tweenLength: true,
          },
          ease: 'power2.out',
        },
        '-=0.65'
      );

      // Line 3b: "final decision." with existing indigo accent
      tl.to(
        line3b,
        {
          duration: 1.35,
          scrambleText: {
            text: 'final decision.',
            chars: SCRAMBLE_CHARS,
            speed: 0.35,
            revealDelay: 0.25,
            tweenLength: true,
          },
          ease: 'power2.out',
        },
        '-=0.35'
      );
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [shouldReduceMotion]);

  return (
    <h1 className={className}>
      {/* Stable screen-reader representation for WCAG accessibility */}
      <span className="sr-only">
        Recruitment, connected from first application to final decision.
      </span>

      {/* Grid container ensuring 0 cumulative layout shift during progressive scramble */}
      <span className="grid grid-cols-1 grid-rows-1" aria-hidden="true">
        {/* Ghost Anchor: preserves exact responsive dimensions, line breaks & height */}
        <span className="col-start-1 row-start-1 invisible pointer-events-none select-none">
          <span className="block sm:whitespace-nowrap">Recruitment, connected</span>
          <span className="block sm:whitespace-nowrap">from first application</span>
          <span className="block">
            to <span className="text-indigo-600">final decision.</span>
          </span>
        </span>

        {/* Animated Scramble Presentation Layer */}
        <span ref={containerRef} className="col-start-1 row-start-1">
          <span ref={line1Ref} className="block sm:whitespace-nowrap">
            Recruitment, connected
          </span>
          <span ref={line2Ref} className="block sm:whitespace-nowrap">
            from first application
          </span>
          <span className="block">
            <span ref={line3aRef}>to </span>
            <span ref={line3bRef} className="text-indigo-600">
              final decision.
            </span>
          </span>
        </span>
      </span>
    </h1>
  );
}
