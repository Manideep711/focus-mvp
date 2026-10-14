# Focus UI foundation

The shared controls adapt the shadcn/Radix Button, Card, Dialog, and Tooltip structure from the earlier **Nexus Lifeline** frontend. The typed Button API and locally bundled Inter font approach also follow **resume-reviewer**. Only reusable UI patterns were brought over; application-specific code and project configuration were left in their own projects.

- [shadcn Button](https://ui.shadcn.com/docs/components/radix/button): Slot composition and typed variants; customized with Focus's palette and sizing.
- [shadcn Dialog](https://ui.shadcn.com/docs/components/radix/dialog): Radix focus trapping, Escape/outside dismissal, layered dialogs, and accessible titles/descriptions. Focus's existing Modal API wraps these primitives and restores focus to the opener.
- [Magic UI Blur Fade](https://magicui.design/docs/components/blur-fade): short entrance animations for page headings and the primary next-action card. Reduced-motion preferences disable the entrance.
- [Aceternity Hover Border Gradient](https://ui.aceternity.com/components/hover-border-gradient): adapted for the “What should I do now?” action, with a quiet hover highlight instead of continuous border animation.
- [Aceternity Card Spotlight](https://ui.aceternity.com/components/card-spotlight): adapted as a lightweight CSS spotlight on task cards, without canvas or continuous rendering. It is disabled for touch and reduced-motion users.

`src/components/primitives/` contains shared controls. `src/components/magicui/` and `src/components/aceternity/` contain adapted effects. `src/workspace.css` holds the workspace visual theme. `components.json` registers the three UI sources and aliases for future additions.

Fonts are bundled locally: Inter Variable for controls and body text; DM Sans Variable for headings and the execution timer. No font CDN is required.
