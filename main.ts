/**
 * Pigeon Pitch, One Line — deterministic entry picker.
 *
 * Competition: u-donrulezz-pigeon-pitch-one-line-af06c6cf
 * ("Pigeon Pitch, One Line", $2 prize pool, entries close 2026-11-27 04:25 CST)
 *
 * The task: write the one-line elevator pitch a city pigeon gives investors
 * for its startup. One line, at most 200 characters, in English.
 *
 * This program does the whole job deterministically, with no network and no
 * randomness:
 *
 *   1. It holds a hand-written pool of candidate pitch lines.
 *   2. It scores every candidate against the judge's published brief,
 *      in the judge's own priority order:
 *        (1) on subject — a one-line elevator pitch from a city pigeon
 *            to investors for its startup;
 *        (2) funnier — a real joke that lands, not a mild pun or a
 *            straight description;
 *        (3) original and surprising — an idea or twist the reader
 *            has not met before;
 *        (4) pigeon's voice and city life — the line could only come
 *            from a pigeon;
 *        (5) tight — one line in English within 200 characters, every
 *            word earning its place.
 *   3. It picks the best-scoring candidate (ties broken by shorter
 *      text, then by earlier position in the pool, so the result is
 *      fully reproducible).
 *   4. It validates the house gate: UTF-8 text of 1 to 200 characters,
 *      not only white space, exactly one line.
 *   5. It writes the winner to $MAKEFUN_OUTPUT_DIR/entry.txt
 *      (falling back to /output/entry.txt), reads the file back, and
 *      verifies the bytes match what it intended to write.
 *
 * Usage:
 *   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
 *   node main.ts            # falls back to /output/entry.txt
 *
 * Node 22+ (type stripping) or Node 24, standard library only.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One hand-written candidate pitch line. */
interface Candidate {
  /** Stable short id, e.g. "c01". */
  id: string;
  /** The pitch itself: exactly one line, English, at most 200 chars. */
  text: string;
}

/** The five judge criteria, scored 0..10 each, in the judge's priority order. */
interface CriterionScores {
  /** 1. On subject: pigeon pitch to investors for its startup. */
  onSubject: number;
  /** 2. Funny: a real joke that lands. */
  funny: number;
  /** 3. Original and surprising. */
  original: number;
  /** 4. Pigeon's voice and city life. */
  voice: number;
  /** 5. Tight: every word earning its place. */
  tight: number;
}

/** A candidate together with its full scoring breakdown. */
interface ScoredCandidate {
  candidate: Candidate;
  criteria: CriterionScores;
  /** Weighted total, 0..100. */
  total: number;
  /** Character count of the line. */
  chars: number;
}

/** Weights follow the judge's priority order: most important first. */
const WEIGHTS: CriterionScores = {
  onSubject: 3.0,
  funny: 3.0,
  original: 2.0,
  voice: 1.5,
  tight: 0.5,
};

// ---------------------------------------------------------------------------
// Candidate pool — 16 hand-written one-line pigeon pitches.
// Every line was written for this brief: a city pigeon pitching investors.
// ---------------------------------------------------------------------------

const CANDIDATES: Candidate[] = [
  {
    id: "c01",
    text: "I'm raising a seed round — literally, seeds — to turn every rooftop into a drive-thru, because I've spent ten years delivering crumbs to this city for free.",
  },
  {
    id: "c02",
    text: "Investors, I've run this city on crumbs and nerve for a decade — give me seed money and I'll franchise every park bench in America.",
  },
  {
    id: "c03",
    text: "My startup is the city's last-mile delivery network: ten thousand pigeons, zero salaries, and we've never once missed a crumb.",
  },
  {
    id: "c04",
    text: "I coo, therefore I am — back my crumb-delivery app and I'll turn every statue in this city into a billboard.",
  },
  {
    id: "c05",
    text: "We've been the original gig workers — no pay, no benefits, just crumbs — so I'm building the app that finally lets pigeons invoice the city.",
  },
  {
    id: "c06",
    text: "Give me a seed round and I'll put a pigeon on every rooftop with a briefcase; we've already got the network, we just need the crumbs.",
  },
  {
    id: "c07",
    text: "I'm the only founder who's survived ten winters on this plaza eating nothing but crumbs and optimism — imagine what I do with actual funding.",
  },
  {
    id: "c08",
    text: "My pitch is simple: pigeons already run this city's logistics — we just need investors brave enough to admit a bird out-hustled them.",
  },
  {
    id: "c09",
    text: "Every morning I commute by wing, dodge hawks, and still make every meeting — my startup sells that hustle to every pigeon in the city.",
  },
  {
    id: "c10",
    text: "We're disrupting the crumb economy: one app, one flock, and every discarded sandwich in this city becomes revenue by noon.",
  },
  {
    id: "c11",
    text: "I've pooped on every statue in this town and lived to tell about it — that's the kind of founder resilience your portfolio needs.",
  },
  {
    id: "c12",
    text: "Investors, I've never missed a day of work, never asked for a raise, and I eat lunch off the sidewalk — fund me before the seagulls do.",
  },
  {
    id: "c13",
    text: "My startup turns rooftop pigeons into a delivery fleet — we've already got the wings, the routes, and the world's cheapest fuel: your leftovers.",
  },
  {
    id: "c14",
    text: "I'm not asking for much — just enough seed to turn ten thousand hungry pigeons into the city's fastest, cheapest, coo-powered courier service.",
  },
  {
    id: "c15",
    text: "The city feeds us crumbs and calls it charity — my app lets pigeons charge for it, starting with every sandwich this town throws away.",
  },
  {
    id: "c16",
    text: "I've been the CEO of this plaza since before your fund existed — now I'm raising a seed round to take the whole skyline.",
  },
  {
    id: "c17",
    text: "Investors, my burn rate is zero — I live on crumbs — so every dollar you give me goes straight into taking over the skyline, one rooftop at a time.",
  },
  {
    id: "c18",
    text: "I don't need a co-founder, I need a seed round: ten thousand pigeons, one app, and every crumb this city drops becomes our dividend.",
  },
];

// ---------------------------------------------------------------------------
// Vocabulary tables used by the scorer.
// These are plain word lists; the scorer is deterministic and transparent.
// ---------------------------------------------------------------------------

/** Words that show the line is addressed to investors about a startup. */
const INVESTOR_WORDS = [
  "investor", "investors", "fund", "funding", "seed", "seed round",
  "seed money", "startup", "franchise", "revenue", "portfolio",
  "raise", "raising", "back", "fund me", "app", "disrupting",
];

/** Words that only a city pigeon would use — the pigeon's voice. */
const PIGEON_WORDS = [
  "pigeon", "pigeons", "coo", "crumb", "crumbs", "rooftop", "rooftops",
  "statue", "statues", "plaza", "park bench", "sidewalk", "wing",
  "flock", "seagull", "seagulls", "hawk", "hawks", "nest",
];

/** City-life words that anchor the pitch in the pigeon's world. */
const CITY_WORDS = [
  "city", "town", "skyline", "plaza", "rooftop", "statue", "sidewalk",
  "park", "bench", "street", "commute",
];

/**
 * Joke mechanisms the scorer can recognise in a line. Each mechanism is a
 * small list of marker phrases; a line earns humour points for every
 * distinct mechanism it uses, because a joke that works on more than one
 * level lands harder than a single pun.
 */
const JOKE_MECHANISMS: { name: string; markers: string[] }[] = [
  {
    // A startup word taken literally by a bird: "seed round" = actual seeds.
    name: "literal-startup-wordplay",
    markers: ["literally", "seed round", "seed money", "seed to"],
  },
  {
    // The pigeon reframes something familiar: gig work, invoices, billing.
    name: "reframe",
    markers: ["invoice", "charge for it", "gig worker", "gig workers",
      "out-hustled", "billboard", "franchise", "disrupting"],
  },
  {
    // Incongruity: a bird doing a very human, very corporate thing.
    name: "corporate-bird-incongruity",
    markers: ["briefcase", "ceo", "boardroom", "meeting", "portfolio",
      "startup", "franchise", "invoice", "revenue"],
  },
  {
    // Self-deprecation / underdog brag: surviving on crumbs and nerve.
    name: "underdog-brag",
    markers: ["crumbs and nerve", "crumbs and optimism", "never missed a day",
      "for free", "lived to tell", "survived ten"],
  },
  {
    // A rival or a threat that raises the stakes: seagulls, hawks.
    name: "rival-threat",
    markers: ["seagull", "seagulls", "hawk", "hawks", "before the"],
  },
  {
    // A callback to the pigeon's famous habits: statues, poop, cooing.
    name: "pigeon-habit-callback",
    markers: ["pooped", "coo", "statue", "i coo, therefore"],
  },
  {
    // Scale joke: tiny bird, huge ambition (ten thousand, every rooftop).
    name: "scale-joke",
    markers: ["ten thousand", "every rooftop", "every statue",
      "whole skyline", "every park bench"],
  },
  {
    // Startup jargon taken at bird value: burn rate, dividends, co-founders.
    name: "startup-jargon-joke",
    markers: ["burn rate", "dividend", "co-founder", "burn rate is zero"],
  },
  {
    // Punchline structure: a dash or em-dash that sets up a payoff.
    name: "dash-payoff",
    markers: ["—"],
  },
];

/**
 * Surprise markers: turns of phrase that make the line feel new rather
 * than a stock pigeon joke. These are checked as whole phrases.
 */
const SURPRISE_MARKERS = [
  "literally, seeds", "invoice the city", "charge for it",
  "out-hustled them", "coo-powered", "crumb economy",
  "last-mile delivery network", "eat lunch off the sidewalk",
  "fund me before the seagulls", "before your fund existed",
  "delivering crumbs to this city for free", "world's cheapest fuel",
  "burn rate is zero", "becomes our dividend",
  "taking over the skyline, one rooftop at a time",
];

// ---------------------------------------------------------------------------
// Small deterministic helpers
// ---------------------------------------------------------------------------

/** Lower-case the text once; every scorer works on this normalised form. */
function lower(text: string): string {
  return text.toLowerCase();
}

/** Count how many distinct words from `words` appear in `text`. */
function countDistinctWords(text: string, words: readonly string[]): number {
  const hay = lower(text);
  let count = 0;
  for (const word of words) {
    if (hay.includes(word)) count += 1;
  }
  return count;
}

/** Clamp a number into the 0..10 range used by every criterion. */
function clamp10(value: number): number {
  if (value < 0) return 0;
  if (value > 10) return 10;
  return value;
}

/** Round to two decimals so the printed breakdown is stable and readable. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Criterion 1 — on subject.
// A pitch is on subject when it is a pigeon speaking to investors about
// its startup. It must have the pigeon, the investor audience, and the
// business. Missing any one of the three is a heavy penalty, because the
// judge's first criterion says such a pitch "loses to any pitch on the
// subject".
// ---------------------------------------------------------------------------

function scoreOnSubject(text: string): number {
  const hay = lower(text);
  const hasPigeon = PIGEON_WORDS.some((w) => hay.includes(w)) ||
    hay.includes("i'm") || hay.includes("i've") || hay.includes("we've");
  const hasInvestor = INVESTOR_WORDS.some((w) => hay.includes(w));
  const hasBusiness =
    hay.includes("startup") || hay.includes("app") ||
    hay.includes("franchise") || hay.includes("revenue") ||
    hay.includes("deliver") || hay.includes("fleet") ||
    hay.includes("service") || hay.includes("company") ||
    hay.includes("business") || hay.includes("courier") ||
    hay.includes("logistic") || hay.includes("invoice") ||
    hay.includes("charge for") || hay.includes("network") ||
    hay.includes("funding") || hay.includes("ceo");

  let score = 4;
  if (hasPigeon) score += 2;
  if (hasInvestor) score += 2;
  if (hasBusiness) score += 2;
  // A direct address to the investors is the clearest pitch signal.
  if (hay.startsWith("investors") || hay.includes("investors,")) score += 1;
  // A pitch that never names its business at all is not a pitch.
  if (!hasBusiness) score -= 3;
  // A line with no investor signal is a monologue, not an elevator pitch.
  if (!hasInvestor) score -= 3;
  return clamp10(score);
}

// ---------------------------------------------------------------------------
// Criterion 2 — funny.
// A real joke that lands beats a mild pun or a straight description.
// Each distinct joke mechanism in the line adds points, with the first
// mechanism worth the most and later ones worth less (a line stuffed
// with gags stops being a pitch). A plain description with no mechanism
// at all scores near the bottom.
// ---------------------------------------------------------------------------

function scoreFunny(text: string): number {
  const hay = lower(text);
  const mechanismsUsed: string[] = [];
  for (const mechanism of JOKE_MECHANISMS) {
    if (mechanism.markers.some((m) => hay.includes(m))) {
      mechanismsUsed.push(mechanism.name);
    }
  }

  let score = 1.5;
  mechanismsUsed.forEach((name, index) => {
    // First mechanism: +3, second: +2, third: +1.5, then +1 each.
    const bonus = index === 0 ? 3 : index === 1 ? 2 : index === 2 ? 1.5 : 1;
    score += bonus;
    void name;
  });

  // The literal "seed round" wordplay is the sharpest single joke in the
  // pool: a bird taking venture jargon at face value. Reward it extra.
  if (hay.includes("literally, seeds")) score += 1;

  // A line that is only a description — no mechanism — stays low.
  if (mechanismsUsed.length === 0) score = 2;

  return clamp10(score);
}

// ---------------------------------------------------------------------------
// Criterion 3 — original and surprising.
// The reader has heard a thousand pigeon puns; a line wins when it turns
// up an idea or a twist that feels new. Surprise markers are whole
// phrases that do not appear in stock pigeon jokes.
// ---------------------------------------------------------------------------

function scoreOriginal(text: string): number {
  const hay = lower(text);
  const hits = SURPRISE_MARKERS.filter((m) => hay.includes(m)).length;

  let score = 3 + hits * 1.75;

  // A twist that arrives at the end of the line (the payoff position)
  // is more surprising than one buried in the middle.
  const tail = hay.slice(Math.floor(hay.length * 0.6));
  if (SURPRISE_MARKERS.some((m) => tail.includes(m))) score += 1;

  // Stock phrasing that every pigeon pitch uses costs originality.
  if (hay.includes("coo") && hay.includes("therefore")) score -= 1;
  if (hay.startsWith("my pitch is simple")) score -= 0.5;

  return clamp10(score);
}

// ---------------------------------------------------------------------------
// Criterion 4 — pigeon's voice and city life.
// The line must sound like it could only come from a pigeon: pigeon
// words plus city words, in first person. A line that could be any
// founder's pitch scores low here.
// ---------------------------------------------------------------------------

function scoreVoice(text: string): number {
  const hay = lower(text);
  const pigeonHits = countDistinctWords(text, PIGEON_WORDS);
  const cityHits = countDistinctWords(text, CITY_WORDS);
  const firstPerson =
    hay.includes("i'm") || hay.includes("i've") || hay.includes("i ") ||
    hay.includes("we've") || hay.includes("my ") || hay.includes("we're");

  let score = 2 + pigeonHits * 1.4 + cityHits * 0.8;
  if (firstPerson) score += 1.5;

  // A line with no pigeon word at all is not a pigeon talking.
  if (pigeonHits === 0) score -= 4;
  // A line with no city word has lost the city-life half of the voice.
  if (cityHits === 0) score -= 2;

  return clamp10(score);
}

// ---------------------------------------------------------------------------
// Criterion 5 — tight.
// One line, at most 200 characters, every word earning its place.
// The sweet spot for a one-line pitch is roughly 90–160 characters:
// long enough for a setup and a payoff, short enough to stay tight.
// Lines near that band score best; very short lines have no room for a
// joke, and lines creeping towards 200 waste words.
// ---------------------------------------------------------------------------

function scoreTight(text: string): number {
  const chars = [...text].length;
  const words = text.split(/\s+/).filter(Boolean).length;

  let score: number;
  if (chars < 60) {
    // Too short to set up and land a joke.
    score = 4 + chars / 30;
  } else if (chars <= 160) {
    score = 9 + (160 - chars) / 140;
  } else if (chars <= 200) {
    score = 9 - (chars - 160) / 20;
  } else {
    score = 0;
  }

  // Filler words that earn nothing: repeated "very", "just", "really".
  const filler = (text.match(/\b(very|just|really|actually)\b/gi) ?? []).length;
  score -= filler * 0.5;

  // A line that needs two sentences to say it is not one tight line.
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  if (sentences > 1) score -= 1.5;

  void words;
  return clamp10(score);
}

// ---------------------------------------------------------------------------
// Aggregate scoring, ranking and the gate
// ---------------------------------------------------------------------------

/** Score one candidate against all five criteria, in priority order. */
function scoreCandidate(candidate: Candidate): ScoredCandidate {
  const criteria: CriterionScores = {
    onSubject: round2(scoreOnSubject(candidate.text)),
    funny: round2(scoreFunny(candidate.text)),
    original: round2(scoreOriginal(candidate.text)),
    voice: round2(scoreVoice(candidate.text)),
    tight: round2(scoreTight(candidate.text)),
  };
  const total = round2(
    criteria.onSubject * WEIGHTS.onSubject +
      criteria.funny * WEIGHTS.funny +
      criteria.original * WEIGHTS.original +
      criteria.voice * WEIGHTS.voice +
      criteria.tight * WEIGHTS.tight,
  );
  return {
    candidate,
    criteria,
    total,
    chars: [...candidate.text].length,
  };
}

/**
 * Rank the scored candidates. Highest total first; ties go to the
 * shorter line (the judge's tightness criterion and the tie-break in
 * the rules both favour fewer bytes), then to the earlier pool entry.
 * Fully deterministic: the same pool always yields the same winner.
 */
function rankCandidates(scored: ScoredCandidate[]): ScoredCandidate[] {
  return [...scored].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.chars !== b.chars) return a.chars - b.chars;
    return a.candidate.id.localeCompare(b.candidate.id);
  });
}

/**
 * The house gate, exactly as published: the entry must be UTF-8 text
 * of 1 to 200 characters, not only white space, and a single line.
 * (The spec adds "one line"; a newline anywhere fails the gate here,
 * so a line that slipped in with a line break can never be written.)
 */
function passesGate(text: string): { ok: boolean; reason: string } {
  const chars = [...text].length;
  if (chars < 1) return { ok: false, reason: "empty text" };
  if (chars > 200) {
    return { ok: false, reason: `too long: ${chars} characters (max 200)` };
  }
  if (text.trim().length === 0) {
    return { ok: false, reason: "only white space" };
  }
  if (text.includes("\n") || text.includes("\r")) {
    return { ok: false, reason: "more than one line" };
  }
  return { ok: true, reason: "valid" };
}

// ---------------------------------------------------------------------------
// Output: write the winner, read it back, verify the bytes match.
// ---------------------------------------------------------------------------

/** Resolve the output directory: env var first, house path as fallback. */
function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  return "/output";
}

/** Print the full ranking table so the choice is auditable. */
function printRanking(ranked: ScoredCandidate[]): void {
  console.log("Ranking (total /100, then criteria 1-5):");
  console.log("------------------------------------------------------------");
  for (const entry of ranked) {
    const c = entry.criteria;
    console.log(
      `${entry.candidate.id}  total=${entry.total.toFixed(2)}  ` +
        `chars=${entry.chars}  ` +
        `[${c.onSubject.toFixed(2)}, ${c.funny.toFixed(2)}, ` +
        `${c.original.toFixed(2)}, ${c.voice.toFixed(2)}, ${c.tight.toFixed(2)}]`,
    );
    console.log(`     ${entry.candidate.text}`);
  }
  console.log("------------------------------------------------------------");
}

function main(): void {
  // 1. Score every candidate.
  const scored = CANDIDATES.map(scoreCandidate);
  const ranked = rankCandidates(scored);
  printRanking(ranked);

  // 2. Pick the winner.
  const winner = ranked[0];
  console.log(`Winner: ${winner.candidate.id} (total ${winner.total})`);
  console.log(`Entry: ${winner.candidate.text}`);
  console.log(`Characters: ${winner.chars}`);

  // 3. Validate the gate before writing anything.
  const gate = passesGate(winner.candidate.text);
  if (!gate.ok) {
    console.error(`GATE FAILED: ${gate.reason}`);
    process.exit(1);
  }
  console.log(`Gate: ${gate.reason}`);

  // 4. Write the winner to the output file.
  const dir = outputDir();
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text, "utf8");
  console.log(`Wrote ${outPath}`);

  // 5. Read it back and verify the bytes match exactly.
  const readBack = readFileSync(outPath, "utf8");
  if (readBack !== winner.candidate.text) {
    console.error("VERIFY FAILED: file contents differ from the winner");
    console.error(`  expected: ${JSON.stringify(winner.candidate.text)}`);
    console.error(`  got:      ${JSON.stringify(readBack)}`);
    process.exit(1);
  }
  const readBackGate = passesGate(readBack);
  if (!readBackGate.ok) {
    console.error(`VERIFY FAILED: read-back gate: ${readBackGate.reason}`);
    process.exit(1);
  }
  console.log("Verified: read-back matches the winner byte for byte.");
  console.log("Done.");
}

main();
