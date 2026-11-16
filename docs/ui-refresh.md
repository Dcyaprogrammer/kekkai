# Typography and calendar refresh

- Use a locally served Geist Sans variable font for the simple technical/SaaS style. Increase body/control text and heading sizes, and widen the calendar relative to tasks.
- Date cells use only thin frames, background color, and text. Selecting a date inverts the entire cell's background/text colors.
- Clicking a date opens an attached day agenda listing its deadlines and dated tasks, with completion/edit controls and an Add deadline button.
- Add deadline slides a form over the entire attachment. Saving returns to the agenda; rescheduling to another date closes the attachment and selects that date. Cancel returns without saving. An open draft survives Escape/outside dismissal attempts. Keyboard focus follows each transition, and reduced-motion settings disable motion.
- Preserve existing validation, local persistence, editing, deletion/undo, and backup behavior. Reuse the item form for task dialogs and deadline attachments.

Font references: [Vercel Geist](https://vercel.com/font) and [shadcn typography](https://ui.shadcn.com/docs/typeset). The font ships through `@fontsource-variable/geist`; page loads do not request a third-party font service. Animation uses CSS and ui-sdk popup lifecycle attributes.
