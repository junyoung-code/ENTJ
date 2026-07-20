# Goals and Ideas Priority Design

## Goal

Make goals support the full Priority interaction and make ideas support ranked ordering without changing existing saved items or unrelated tabs.

## Behaviour

- Goals display a numbered rank, move up/down controls, and expandable sub-goals. Completing every sub-goal completes its parent goal.
- Ideas display a numbered rank and move up/down controls. They do not have sub-items.
- Completing an item continues to place it in the existing completed section.
- Existing items without a `priority` field are normalized to their current displayed order when saved.

## Architecture

`createCollectionFeature` gains optional ranked-list behavior. The existing goals and ideas configuration enables it, with `subItems` enabled only for goals. The tab markup opts into the existing priority-list styling, with small reusable collection-specific styles for completed and sub-item states.

## Constraints

- Preserve existing local/cloud storage format and data.
- Reuse the current modal, inline editing, and delete controls.
- Do not change To Do, Priority, or other tab behaviour.
