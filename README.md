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

1. Select a formation and place it on a deployment node.
2. Build the Trapline combination from terrain and support arcs.
3. Choose a doctrine and run the Ghost Drill.
4. Commit the mission and watch the plan execute.
5. Spend scarce Command Seals only when battlefield contingencies demand it.

## Validation

```powershell
npm.cmd run build
npm.cmd run test:sites
```

The prototype uses only local, generated original-IP visual assets and makes no runtime network requests.

