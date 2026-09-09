#!/usr/bin/env python3
"""Does the skill's description fire on the right prompts, and stay out of the way otherwise?

    python3 .claude/skills/new-itinerary/evals-trigger.py [-n 3] [--model <id>] [-q]

Reads evals-trigger.json beside this file: queries paired with whether the
skill should reach for them. Each one is put to `claude -p` from the
repository root, so the skill is seen exactly as it would be in a real
session, and the run counts as a trigger if the transcript shows the Skill
tool invoking it or anything reading its SKILL.md.

Run it in a normal terminal. Nested inside a Claude Code session the child
process can attach to the calling session and never take a turn, which scores
every query as "did not trigger" whether it should have or not.
"""

import argparse
import json
import os
import pathlib
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
SKILL = HERE.name
REPO = HERE.parents[3]


def triggered(query: str, model: str | None, timeout: int,
              show: bool = False) -> bool | None:
    """True/False, or None if the run failed to produce a transcript."""
    cmd = ["claude", "-p", query, "--output-format", "stream-json", "--verbose"]
    if model:
        cmd += ["--model", model]
    # The guard against nesting is for interactive terminals; a subprocess is fine.
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    try:
        p = subprocess.run(cmd, cwd=REPO, env=env, timeout=timeout,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        return None

    saw_turn, hit = False, False
    for line in p.stdout.decode("utf-8", "replace").splitlines():
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        if show and ev.get("type") == "system":
            names = [c.get("name") for c in ev.get("commands", []) or []]
            if SKILL in names:
                print(f"  [registered] the skill is offered to this run")
        if ev.get("type") != "assistant":
            continue
        saw_turn = True
        for c in ev.get("message", {}).get("content", []):
            if c.get("type") == "text" and show and c.get("text", "").strip():
                print(f"  [text] {c['text'].strip()[:300]}")
            if c.get("type") != "tool_use":
                continue
            inp = c.get("input") or {}
            if show:
                print(f"  [tool] {c.get('name')} {json.dumps(inp)[:160]}")
            if c.get("name") == "Skill" and inp.get("skill") == SKILL:
                hit = True
            # Reading the skill counts too: that is what invoking it does.
            elif SKILL in str(inp.get("file_path", "")) + str(inp.get("path", "")):
                hit = True
    if show:
        print(f"  => turns seen: {saw_turn}, skill invoked: {hit}")
    return hit if saw_turn else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", "--runs", type=int, default=3, help="runs per query (default 3)")
    ap.add_argument("--model", default=None)
    ap.add_argument("--timeout", type=int, default=300, help="seconds per run")
    ap.add_argument("-j", "--jobs", type=int, default=4)
    ap.add_argument("-q", "--quiet", action="store_true")
    ap.add_argument("--debug", metavar="QUERY", default=None,
                    help="run one query once and print what the transcript actually "
                         "contained, instead of scoring the set")
    a = ap.parse_args()

    if a.debug:
        print(f"query: {a.debug}")
        triggered(a.debug, a.model, a.timeout, show=True)
        return 0

    evals = json.loads((HERE / "evals-trigger.json").read_text())
    jobs = [(e, i) for e in evals for i in range(a.runs)]
    with ThreadPoolExecutor(max_workers=a.jobs) as pool:
        outcomes = list(pool.map(lambda j: triggered(j[0]["query"], a.model, a.timeout), jobs))

    by_query: dict[str, list] = {}
    for (e, _), got in zip(jobs, outcomes):
        by_query.setdefault(e["query"], []).append(got)

    broken = sum(1 for o in outcomes if o is None)
    if broken == len(outcomes):
        print("Every run failed to produce a transcript — `claude -p` is not taking a turn "
              "here.\nRun this in a plain terminal, outside a Claude Code session.",
              file=sys.stderr)
        return 2

    passed = 0
    print(f"{'want':>5}  {'rate':>5}  {'':4} query")
    print("-" * 78)
    for e in evals:
        got = by_query[e["query"]]
        fired = sum(1 for g in got if g is True)
        usable = sum(1 for g in got if g is not None)
        rate = fired / usable if usable else 0.0
        ok = (rate >= 0.5) == e["should_trigger"]
        passed += ok
        if not a.quiet or not ok:
            flag = " ok " if ok else "MISS"
            print(f"{'FIRE' if e['should_trigger'] else 'skip':>5}  "
                  f"{fired}/{usable or '-':<3}  {flag}  {e['query'][:56]}")
    print("-" * 78)
    print(f"{passed}/{len(evals)} as expected" + (f"  ({broken} runs failed)" if broken else ""))
    return 0 if passed == len(evals) else 1


if __name__ == "__main__":
    sys.exit(main())
