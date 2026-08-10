# Project Warhost

Project Warhost is an original-IP mission tactics prototype about planning a battlefield operation, watching autonomous formations execute it, and spending only two Command Seals when the plan meets reality.

The first playable slice, **Operation Dead Circuit**, asks the Scrapborn Freeholds to seize two control nodes, sabotage a reactor, and extract at least three formations before reinforcements arrive.

## Play locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173/`.

## Core loop

1. Choose Trapline, Armored Spear, or Divided Pressure and inspect its numbered, directional field plan; every playbook redraws the battlefield geometry.
2. Staff the playbook's fixed action stops by dragging formations from the roster or clicking a stop to choose. Every formation exposes a neutral tactical vocabulary (`CREATES` and `USES`) without a preferred answer. Adjacent placements can reveal named combo chains—such as `DISPLACED → KILL ZONE`—or remain independent actions.
3. Author two responses at known battlefield breakpoints. Selecting an alternate order redraws the affected route leg before commitment.
4. Run the Ghost Drill, commit the playbook, and watch it execute autonomously.
5. At contact, compare the authored route with the override route, then execute the plan for free or spend a scarce Command Seal to break it.

## Validation

```powershell
npm.cmd run build
npm.cmd run test:sites
```

The prototype uses only local, generated original-IP visual assets and makes no runtime network requests.

Operation Dead Circuit is won by sabotaging the Reactor Spine and extracting at least three formations. Rescuing the salvage crew is optional.
