# Push feature branches to their own remote branch

Pushing to `main` deploys straight to GitHub Pages (`.github/workflows/deploy.yml` runs on every push to `main`), so feature work never goes there directly:

1. Create a feature branch without tracking its base: `git switch -c <feature-branch> --no-track origin/main`. Starting from `origin/main` otherwise makes the branch track `main`, so a plain push (or an IDE push) targets `main`.
2. Push it to its own branch on origin: `git push -u origin <feature-branch>`.
3. Before any push, check the upstream is the branch's own: `git rev-parse --abbrev-ref @{upstream}` must print `origin/<feature-branch>`, never `origin/main`. If it is wrong, fix it first: `git branch --unset-upstream`, then step 2.
4. Never push a feature branch's commits to `main`, and never fast-forward `main` to a feature branch, unless the user explicitly asks for it in that same turn.
5. Getting feature work into `main` is its own explicit step, done only when the user asks for it.
