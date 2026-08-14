# Optional: rewriting repository history

**Recommendation: don't run this.** It is written down so the choice is yours, not
because it needs doing. Read the trade-off first.

## What it would fix

Two things, both cosmetic rather than functional:

1. **Repository size.** `.git` is about 68 MB against roughly 2 MB of source. The 41
   audit screenshots were moved into `docs/audit/` in the working tree, so the repo
   stops growing, but their blobs remain in history and every fresh clone still pays
   for them.
2. **Author email.** All 76 commits carry `jonathan.falkowski@gmail.com`.

## Why it probably isn't worth it

The repository is public. The email has already been published across 76 commits and
is visible to GitHub's API, any existing clone, any fork, and third-party mirrors that
scrape public repos. **Rewriting history does not un-publish it.** It only changes what
a future clone sees.

Against that, a rewrite changes every commit SHA in the repository. Any clone, fork,
open pull request, or link to a specific commit breaks permanently, and the force-push
cannot be undone from the remote side. For a solo prototype, paying that cost to
reclaim 66 MB and to partially close an exposure that is already public is a poor
trade.

## The cheap fix that is actually worth doing

Stop new commits from carrying the personal address. This is non-destructive and takes
one command:

```powershell
# Find your GitHub noreply address at:
#   github.com -> Settings -> Emails -> "Keep my email addresses private"
# It looks like: 12345678+jonathanfalkowski-byte@users.noreply.github.com

git config user.email "12345678+jonathanfalkowski-byte@users.noreply.github.com"
```

Set it without `--global` to scope it to this repository, or with `--global` to apply
it everywhere. Also tick **Block command line pushes that expose my email** on that
same GitHub settings page, which stops the mistake recurring.

## If you decide to rewrite anyway

Use `git-filter-repo`. Do not use `git filter-branch` — it is deprecated, far slower,
and easy to get wrong.

```powershell
pip install git-filter-repo

# 1. BACK UP FIRST. This is the step that makes the operation recoverable.
cd ..
git clone --mirror project-warhost project-warhost-backup.git
cd project-warhost

# 2. Confirm what would be removed, before removing it.
git filter-repo --analyze
#    Then read .git/filter-repo/analysis/blob-shas-and-paths.txt

# 3. Drop the screenshot blobs from history.
#    --invert-paths means "remove these paths" rather than "keep only these".
git filter-repo --invert-paths ^
  --path-glob "audit-*.png" ^
  --path-glob "design-qa-*.png" ^
  --path-glob "implementation-*.png"

# 4. Rewrite authorship. Replace with your own noreply address.
git filter-repo --email-callback ^
  "return email if email != b'jonathan.falkowski@gmail.com' else b'12345678+jonathanfalkowski-byte@users.noreply.github.com'"

# 5. Verify BEFORE pushing: history is intact, size dropped, working tree builds.
git log --oneline | Measure-Object -Line      # expect 76
git count-objects -vH                          # expect size-pack well under 68 MB
npm.cmd run test:game
npm.cmd run build

# 6. Point at the remote again (filter-repo removes it deliberately) and force-push.
git remote add origin https://github.com/jonathanfalkowski-byte/project-warhost.git
git push --force --all origin
git push --force --tags origin
```

Note that `docs/audit/` is excluded from the globs above, so the screenshots stay in
your working tree and in the new history from the commit that added them there. If you
want them gone from the working tree too, delete them before step 3.

Afterwards, delete every existing local clone and re-clone. A stale clone that still
has the old history can push it straight back and undo the whole operation.

If anything looks wrong, restore from the mirror made in step 1:

```powershell
cd ..\project-warhost-backup.git
git push --force --mirror https://github.com/jonathanfalkowski-byte/project-warhost.git
```
