# Reusable Liquid Glass Button Integration Prompt

Integrate the supplied Liquid Glass button into this project without changing unrelated UI or behavior.

- Confirm the existing framework, TypeScript, Tailwind, and `components/ui` conventions; reuse them rather than scaffolding a new project.
- Place the reusable component at `components/ui/liquid-glass-button.tsx` and use the project's shared `cn` utility.
- Install only the required button dependencies: `@radix-ui/react-slot` and `class-variance-authority`.
- Preserve accessible names, keyboard focus, disabled behavior, and the `asChild` composition API.
- Use the button only for the primary call to action on the `/hero` entry page, linking directly to `/upload`.
- Keep the effect responsive and ensure the label remains legible over the dark hero background.
- Validate with the production build and focused tests.
