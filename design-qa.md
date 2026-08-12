# Design QA — Persistent Battlefield Read

Validated at a 1280 × 720 desktop viewport against the local production build.

## Setup

- The formation tray occupies 209 px at the bottom of the battlefield while the authored route map remains visible in the 303 px stage above it.
- Enemy formations, stops, and routes remain visible before commitment.
- Optional combo details start collapsed so route responsibilities remain the first read.
- Command-seal choices state their delay, protection, rescue, and abandonment consequences directly.

## Execution

- The formation tray contracts to 78 px and the battlefield expands to 434 px.
- The route roster and upcoming rendezvous remain visible in the compact tray.
- Enemy formations stay readable during contact focus and receive small endpoint offsets when multiple routes converge.
- Playback controls, route timeline, mission pressure, and enemy wave countdown remain accessible.

## Outcome

- Speed is described as a survival constraint: beating the enemy wave preserves formations and Warhost Integrity but grants no bonus resources.
- Recovery remains contingent on the route reaching extraction; assigning the recovery vehicle to the recovery responsibility does not make it invulnerable.

## Known prototype limit

- The isometric foundry remains visually dense at narrow desktop widths. The persistent enemy markers and compact execution tray improve tracking without replacing the map artwork or authored routes.
