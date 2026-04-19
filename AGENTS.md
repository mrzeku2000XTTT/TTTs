# Hyperframes Motion Design Knowledge Base

This project focuses on generating high-quality cinematic animations using GSAP. When assisting with this project, always apply the following professional motion design principles derived from our LLM motion curriculum:

## The 4 Layers of Motion Design
1. **Physical Layer:** Precision in easing curves (cubic-bezier, expo, elastic), physics simulation, spring dynamics, inertia, and overshoot.
2. **Compositional Layer:** Stagger timing, element hierarchy, choreography, and rhythm.
3. **Narrative Layer:** Alignment with emotional intent, brand voice, and guiding viewer attention.
4. **Technical Layer:** Mastery of precise tool syntax (GSAP, CSS keyframes, etc.).

## Key Terminology & Standards
- **Duration:** Standard UI animations run 100ms–800ms out of the box, while cinematic Hyperframes transitions should be paced meticulously over their `data-duration` blocks.
- **Overshoot:** Allow animations to exceed target values slightly before settling to create an elastic, organic feel.
- **Stagger:** Always apply sequential delays to grouped elements (e.g., `stagger: { amount: 0.8 }`).
- **Easing Profiles:** Never use default linear or ease-in-out without intention. Drive momentum with specific mathematical curves (e.g., `cubic-bezier(0.32, 0.72, 0, 1)` or GSAP's `expo.out`, `power4.inOut`, `back.out(1.7)`, `elastic.out(1, 0.3)`).
- **Motion Blur & Depth:** Simulate real-world camera exposure using dynamic CSS `filter: blur(20px)` fading to `0px`.

## Generation Workflow for Complex Layouts
When building highly complex multi-scene components:
1. **Scene Planning:** Establish the high-level motion narrative across structural `<div class="clip scene-container">` wrappers.
2. **Per-scene Spec:** Detail the exact timing and easing for each sub-scene.
3. **Code Generation:** Translate the spec into GSAP timelines using chronologically chained elements, `data-start`, `data-duration`, and overlapping position parameters (e.g., `"<"`, `"-=0.5"`).
4. **Layer Synchronizations:** Ensure all sweeps, fades, and staggers sync to the implied audio or rhythmic beat of the environment.

Always utilize the highest echelon of editorial styling and cinematic pacing when generating code for this workspace.
