# scripts/design/codemod-phase1.py
#
# Phase 1 of the design.md migration: mechanical token substitution.
#
# SINGLE PASS, LONGEST-FIRST. Every rule lives in one alternation,
# applied by one re.sub with a callback. Running the rules in sequence
# would cascade: `rounded-3xl` -> `rounded-lg` -> `rounded-sm` would
# collapse three distinct radii into one, and a bare `text-white` rule
# would eat the stem of `text-white/50` before the opacity rule saw it.
#
# DOES NOT TOUCH
#   - font sizes. Phase 2, and genuinely manual: `text-[13px]` maps to
#     `text-small` or `text-body` depending on whether it was content
#     or a label, and only a human can tell.
#   - `rounded-full`. Correct for avatars, status dots and progress
#     tracks; wrong on buttons. Same reason.
#
# Usage:  python3 codemod-phase1.py src           # dry run
#         python3 codemod-phase1.py src --apply

import pathlib
import re
import sys

# Variant prefixes that may sit in front of a utility class. Kept and
# re-attached, so `hover:text-white/50` -> `hover:text-ink-muted`.
PRE = (r"(?:hover:|focus:|focus-visible:|active:|disabled:|group-hover:|"
       r"peer-focus:|placeholder:|first:|last:|odd:|even:|"
       r"sm:|md:|lg:|xl:|2xl:|dark:)*")

# ── RAW: replacement may contain a \1 backreference ─────────────────
RAW: list[tuple[str, str]] = [
    # The lime glow, deleted outright. Two shadows exist in the system,
    # both neutral, and cards get neither.
    (r"\s*" + PRE + r"(?:drop-)?shadow-\[[^\]]*204\s*,\s*255\s*,\s*0[^\]]*\]", ""),

    # NAMED GROUPS, NOT \1. These patterns are concatenated into one
    # alternation, which renumbers every group — a positional
    # backreference silently resolves to a different rule's capture and
    # drops the utility prefix, turning `bg-[#CCFF00]` into `-indigo`.
    (r"(?P<ua>[a-z-]+)-\[#[Cc][Cc][Ff][Ff]00\]", r"\g<ua>-indigo"),
    (r"(?P<ub>[a-z-]+)-\[#[Dd]9[Ff][Ff]33\]", r"\g<ub>-indigo-lift"),

    # The six accumulated greys. #0D0F13 and #0D0F12 differ by one in
    # the blue channel; nobody chose both. Two real surfaces now.
    (r"(?P<uc>[a-z-]+)-\[#(?:090A0C|0D0F13|0D0F12|101216)\]", r"\g<uc>-paper"),
    (r"(?P<ud>[a-z-]+)-\[#(?:14161A|1F2228)\]", r"\g<ud>-paper-raised"),

    # Bare hex in an inline style or SVG attribute. The accent is
    # unambiguous. The GREYS ARE NOT: the same hex means "ground" after
    # `background` and "ink" after `color`, so those are left alone and
    # reported at the end for a human to read.
    (r"#[Cc][Cc][Ff][Ff]00", "var(--indigo)"),
    (r"#[Dd]9[Ff][Ff]33", "var(--indigo-lift)"),

    # A heavy black fill was the page ground. A light one was a scrim
    # over content and must stay dark — expressed as ink, not paper.
    (r"\bbg-black/(?:4[0-9]|[5-9][0-9]|100)\b", "bg-paper"),
    (r"\bbg-black/\[0\.[4-9][0-9]?\]", "bg-paper"),
    (r"\bbg-black/(?P<op>[1-3]?[0-9])\b", r"bg-ink/\g<op>"),
    (r"\bbg-black\b", "bg-paper"),
]


# ── PREFIXED: variant prefix preserved, stem replaced wholesale ─────
# Ordered longest-first within each family.
PREFIXED: list[tuple[str, str]] = [
    # Opacity bands, read as intent: at /80 and above white was the
    # primary text colour, /50-/79 was secondary, below that was meta.
    (PRE + r"text-white/\[0\.(?:[89][0-9]?|100)\]", "text-ink"),
    (PRE + r"text-white/(?:8[0-9]|9[0-9]|100)\b", "text-ink"),
    (PRE + r"text-white/\[0\.[5-7][0-9]?\]", "text-ink-muted"),
    (PRE + r"text-white/(?:5[0-9]|6[0-9]|7[0-9])\b", "text-ink-muted"),
    (PRE + r"text-white/\[0\.[0-4][0-9]?\]", "text-ink-faint"),
    (PRE + r"text-white/(?:[1-9]|[1-4][0-9])\b", "text-ink-faint"),
    (PRE + r"text-white\b", "text-ink"),

    # Hairlines. 247 occurrences of white/[0.0x] in the old build.
    (PRE + r"border-white/(?:\[[^\]]*\]|\d+)", "border-rule"),
    (PRE + r"divide-white/(?:\[[^\]]*\]|\d+)", "divide-rule"),
    (PRE + r"ring-white/(?:\[[^\]]*\]|\d+)", "ring-rule"),
    (PRE + r"outline-white/(?:\[[^\]]*\]|\d+)", "outline-rule"),

    # Subtle white fills were the raised and sunken surfaces.
    (PRE + r"bg-white/(?:\[[^\]]*\]|\d+)", "bg-paper-sunken"),
    (PRE + r"fill-white\b", "fill-ink"),
    (PRE + r"stroke-white\b", "stroke-ink"),

    # Four radii replace six.
    (PRE + r"rounded-t-(?:3xl|2xl|xl)\b", "rounded-t-md"),
    (PRE + r"rounded-b-(?:3xl|2xl|xl)\b", "rounded-b-md"),
    (PRE + r"rounded-(?:3xl|4xl)\b", "rounded-lg"),
    (PRE + r"rounded-(?:2xl|xl)\b", "rounded-md"),
    (PRE + r"rounded-(?:lg|md)\b", "rounded-sm"),
]

_parts = (["(?P<r%d>%s)" % (i, p) for i, (p, _) in enumerate(RAW)]
          + ["(?P<p%d>%s)" % (i, p) for i, (p, _) in enumerate(PREFIXED)])
RX = re.compile("|".join(_parts))


def _replace(m: re.Match, tally: dict) -> str:
    for name, val in m.groupdict().items():
        if val is None:
            continue
        i = int(name[1:])
        if name[0] == "r":
            pat, repl = RAW[i]
            tally[pat] = tally.get(pat, 0) + 1
            return m.expand(repl)
        pat, repl = PREFIXED[i]
        tally[pat] = tally.get(pat, 0) + 1
        whole = m.group(0)
        cut = whole.rfind(":")
        return (whole[: cut + 1] if cut != -1 else "") + repl
    return m.group(0)


def apply(text: str, tally: dict) -> tuple[str, int]:
    n = 0

    def go(m: re.Match) -> str:
        nonlocal n
        n += 1
        return _replace(m, tally)

    return RX.sub(go, text), n


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "src")
    apply_it = "--apply" in sys.argv
    tally: dict = {}
    files = edits = 0
    for path in sorted(root.rglob("*.tsx")):
        raw = path.read_bytes().decode("utf-8")
        out, n = apply(raw.replace("\r\n", "\n"), tally)
        if not n:
            continue
        files += 1
        edits += n
        print("%5d  %s" % (n, path.as_posix()))
        if apply_it:
            path.write_bytes(out.replace("\n", "\r\n").encode("utf-8"))

    print("\n--- rule hits ---")
    for pat, c in sorted(tally.items(), key=lambda kv: -kv[1]):
        short = pat.replace(PRE, "<var>").replace("\\b", "")
        print("%5d  %s" % (c, short[:88]))
    print("\n%s: %d edits across %d files"
          % ("APPLIED" if apply_it else "DRY RUN", edits, files))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
