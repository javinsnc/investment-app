---
name: python-venv
description: Use the project Python virtualenv at .venv for ALL Python work in this repo — running scripts and installing packages (pip install). ALWAYS use this venv instead of the system python; never install packages globally and never ask the user to set up an environment. Invoke whenever a task needs a Python package, a Python script, or `pip install` in the investment-app repo.
---

# python-venv

This repo has a dedicated Python virtualenv for ad-hoc Python work (scripts,
data analysis, querying the database). Use it for everything Python: running
scripts and installing dependencies. Do not ask the user to create or activate
an environment — it already exists.

## Location

```
/Users/javier.sangrador/dev/personal/investment-app/.venv
```

It is listed in `.gitignore` (`.venv`), so it is never committed.

## Critical: which Python

The system `python3` on PATH is **Python 3.6** from
`/Library/Frameworks/Python.framework/Versions/3.6/`. It is broken on this
macOS — its process gets SIGKILL'd (commands exit with code 137 and no output).
**Never use it.**

The venv was built with Homebrew Python 3.13 (`/opt/homebrew/bin/python3.13`).
If the venv is ever missing, recreate it with:

```bash
/opt/homebrew/bin/python3.13 -m venv /Users/javier.sangrador/dev/personal/investment-app/.venv
/Users/javier.sangrador/dev/personal/investment-app/.venv/bin/python -m pip install --upgrade pip
```

## How to use it

Call the venv's binaries by absolute path — no need to "activate":

```bash
# install a package
/Users/javier.sangrador/dev/personal/investment-app/.venv/bin/pip install psycopg2-binary

# run a script
/Users/javier.sangrador/dev/personal/investment-app/.venv/bin/python path/to/script.py

# one-off code
/Users/javier.sangrador/dev/personal/investment-app/.venv/bin/python -c "import sys; print(sys.version)"
```

When invoked from the repo root the relative form `.venv/bin/python` also works.

## Rules

- Always install into this venv (`.venv/bin/pip`), never globally.
- Never invoke the bare `python3` / `pip3` from PATH (broken 3.6).
- Install whatever a task needs without asking — that is the point of this venv.
