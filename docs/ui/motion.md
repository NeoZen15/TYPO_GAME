# Motion

Motion is implemented with GSAP + ScrollTrigger in `features/landing/components/Gate.tsx`.

Current motion contracts:
- Intro on `.block-1` uses a Framer-like two-layer morph (`base` + animated `live`) on `LOOK CLOSER`.
- Section 2 heading uses a CSS-only threshold morph effect while keeping the title text `WHAT TO EXPECT`.
- Section 2 copy reveal uses `SplitText` line animation tied to scroll.
- Section 4 reel spins only while the section is sufficiently in view.
- Section 5 guides are scroll-drawn via native `scroll` + `resize` listeners with absolute thresholds:
  `startScroll = letterTopAbs - viewportHeight*0.85`,
  `endScroll = letterCenterAbs - viewportHeight/2`,
  `progress = clamp((scrollY - startScroll)/(endScroll - startScroll), 0, 1)`.
- Section 5 guide paths use one shared progress (all lines draw together from 0 to 100%).
- Reduced-motion users must keep the no-animation fallbacks in CSS.

When cleaning code, treat durations, easings, trigger starts/ends, and animation ordering as behavior-critical.
