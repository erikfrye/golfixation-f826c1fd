## Goal
Reorganize the tournament setup/edit page (`/admin/tournaments/$id`) for clearer grouping and field order.

## Changes
1. **Field order** — reorder from current to:
   - Name
   - Start date & time
   - Status
   - Start format
   - Format
   - Tee shot minimum (conditional on `format === "texas_scramble"`)
   - Allow mulligans
   - Hole pars
   - Advanced Settings (accordion)

2. **Advanced Settings accordion** — wrap the existing `<Accordion>` around:
   - Override code
   - About (override)

   Keep all existing field logic, labels, help text, and validation.

## No-op areas
- No database changes.
- No RLS or auth changes.
- No route or API changes.
- Preserve existing `useState`, `useEffect`, and `save()` logic exactly.

## Files changed
- `src/routes/admin.tournaments.$id.tsx`

## Accordion component
Use existing `src/components/ui/accordion.tsx` (`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`). Import it in the route file. Set `type="single"` and `collapsible` so it defaults closed.
