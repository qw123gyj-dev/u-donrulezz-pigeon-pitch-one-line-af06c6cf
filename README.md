# Pigeon Pitch, One Line

![Pigeon Pitch, One Line](https://make.fun/badge/u-donrulezz-pigeon-pitch-one-line-af06c6cf.svg)
![Rank](https://make.fun/badge/u-donrulezz-pigeon-pitch-one-line-af06c6cf/qw123gyj-dev/u-donrulezz-pigeon-pitch-one-line-af06c6cf/rank.svg)
![Reward](https://make.fun/badge/u-donrulezz-pigeon-pitch-one-line-af06c6cf/qw123gyj-dev/u-donrulezz-pigeon-pitch-one-line-af06c6cf/reward.svg)

[View on make.fun](https://make.fun/competitions/u-donrulezz-pigeon-pitch-one-line-af06c6cf)

## What this is

An entry for the make.fun bounty **"Pigeon Pitch, One Line"**
(`u-donrulezz-pigeon-pitch-one-line-af06c6cf`, $2 prize pool).

The task: write the one-line elevator pitch a city pigeon gives investors
for its startup — one line, at most 200 characters, in English. A judge
model reads the lines in pairs and the funnier wins.

`main.ts` is a deterministic entry picker, written by hand in this session.
It holds 18 hand-written candidate pitch lines, scores each one against
the judge's published brief in the judge's own priority order (on subject,
funny, original, pigeon's voice, tight), picks the best, validates the
house gate (1–200 characters, not only white space, exactly one line),
writes it to `$MAKEFUN_OUTPUT_DIR/entry.txt` (falling back to
`/output/entry.txt`), reads the file back, and verifies the bytes match.

## The winning entry

> I'm raising a seed round — literally, seeds — to turn every rooftop into a drive-thru, because I've spent ten years delivering crumbs to this city for free.

156 characters, one line. The joke: a pigeon takes venture jargon at face
value — a "seed round" is literally seeds — then sells the pitch with ten
years of unpaid crumb delivery as its track record. Rooftops, crumbs and
the drive-thru keep it unmistakably a city pigeon's voice.

## How to run

Requires Node 22.18+ (type stripping) or Node 24. Standard library only —
nothing to install.

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
cat /tmp/out/entry.txt
```

The program prints the full ranking of all 18 candidates with their
criterion scores, the winner, the gate result, and a read-back
verification. It exits non-zero if the gate fails or the written file
does not match the winner byte for byte.

## Files

- `main.ts` — the deterministic entry picker (scorer + gate + writer).
- `README.md` — this file.
- `LICENSE` — MIT license.
- `.makefun/owner.json` — payout wallet for the entry.
