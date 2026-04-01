Publishing to GitHub
====================

These steps create a new GitHub repo under the `Terexitariusstomps` account and push this codebase.

Option A: Web UI + HTTPS
1) Create the repo:
   - Visit https://github.com/new
   - Owner: `Terexitariusstomps`
   - Repository name: `agritrace` (or your preferred name)
   - Visibility: Public (or Private)
   - Do not initialize with README/gitignore; you already have them locally

2) Add remote and push from your terminal in the project root:
```
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/Terexitariusstomps/agritrace.git
git push -u origin main
```
Git will prompt for credentials. Use a Personal Access Token (classic) with `repo` scope as the password.

Option B: GitHub CLI (gh)
```
gh auth login   # follow interactive login
gh repo create Terexitariusstomps/agritrace --public --source . --remote origin --push --branch main
```

Local repo already prepared
- This repository is already initialized with `main` and has `origin` set to `https://github.com/Terexitariusstomps/agritrace.git`.
- If you rename the repo, update the remote accordingly:
```
git remote set-url origin https://github.com/Terexitariusstomps/<new-name>.git
```

