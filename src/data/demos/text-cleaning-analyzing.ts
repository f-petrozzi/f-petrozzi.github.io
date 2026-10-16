// Pure logic for the Text Cleaning & Analyzing demo: a six-step regex
// pipeline over an excerpt of The Wonderful Wizard of Oz (public domain),
// plus word frequencies, sentence lengths and bag-of-words similarity.

export const EXCERPT = `The Project Gutenberg eBook of The Wonderful Wizard of Oz

This ebook is for the use of anyone anywhere in the United States and
most other parts of the world at no cost and with almost no restrictions
whatsoever. You may copy it, give it away or re-use it under the terms
of the Project Gutenberg License included with this ebook or online at
www.gutenberg.org.

Title: The Wonderful Wizard of Oz

Author: L. Frank Baum

Illustrator: W. W. Denslow

Release date: June 25, 2008 [eBook #55]

Language: English

*** START OF THE PROJECT GUTENBERG EBOOK THE WONDERFUL WIZARD OF OZ ***

Chapter I.
The Cyclone

Dorothy lived in the midst of the great Kansas prairies, with Uncle Henry, who was a farmer, and Aunt Em, who was the farmer’s wife. Their house was small, for the lumber to build it had to be carried by wagon many miles. There were four walls, a floor and a roof, which made one room; and this room contained a rusty looking cookstove, a cupboard for the dishes, a table, three or four chairs, and the beds. Uncle Henry and Aunt Em had a big bed in one corner, and Dorothy a little bed in another corner. There was no garret at all, and no cellar—except a small hole dug in the ground, called a cyclone cellar, where the family could go in case one of those great whirlwinds arose, mighty enough to crush any building in its path. It was reached by a trap door in the middle of the floor, from which a ladder led down into the small, dark hole.

When Dorothy stood in the doorway and looked around, she could see nothing but the great gray prairie on every side. Not a tree nor a house broke the broad sweep of flat country that reached to the edge of the sky in all directions. The sun had baked the plowed land into a gray mass, with little cracks running through it. Even the grass was not green, for the sun had burned the tops of the long blades until they were the same gray color to be seen everywhere. Once the house had been painted, but the sun blistered the paint and the rains washed it away, and now the house was as dull and gray as everything else.

When Aunt Em came there to live she was a young, pretty wife. The sun and wind had changed her, too. They had taken the sparkle from her eyes and left them a sober gray; they had taken the red from her cheeks and lips, and they were gray also. She was thin and gaunt, and never smiled now. When Dorothy, who was an orphan, first came to her, Aunt Em had been so startled by the child’s laughter that she would scream and press her hand upon her heart whenever Dorothy’s merry voice reached her ears; and she still looked at the little girl with wonder that she could find anything to laugh at.

Uncle Henry never laughed. He worked hard from morning till night and did not know what joy was. He was gray also, from his long beard to his rough boots, and he looked stern and solemn, and rarely spoke.

It was Toto that made Dorothy laugh, and saved her from growing as gray as her other surroundings. Toto was not gray; he was a little black dog, with long silky hair and small black eyes that twinkled merrily on either side of his funny, wee nose. Toto played all day long, and Dorothy played with him, and loved him dearly.

Chapter II.
The Council with the Munchkins

Dorothy was awakened by a shock, so sudden and severe that if she had not been lying on the soft bed she might have been hurt. As it was, the jar made her catch her breath and wonder what had happened; and Toto put his cold little nose into her face and whined dismally. Dorothy sat up and noticed that the house was not moving; nor was it dark, for the bright sunshine came in at the window, flooding the little room. She sprang from her bed and with Toto at her heels ran and opened the door.

The little girl gave a cry of amazement and looked about her, her eyes growing bigger and bigger at the wonderful sights she saw.

The cyclone had set the house down very gently—for a cyclone—in the midst of a country of marvelous beauty. There were lovely patches of greensward all about, with stately trees bearing rich and luscious fruits. Banks of gorgeous flowers were on every hand, and birds with rare and brilliant plumage sang and fluttered in the trees and bushes. A little way off was a small brook, rushing and sparkling along between green banks, and murmuring in a voice very grateful to a little girl who had lived so long on the dry, gray prairies.

While she stood looking eagerly at the strange and beautiful sights, she noticed coming toward her a group of the queerest people she had ever seen. They were not as big as the grown folk she had always been used to; but neither were they very small. In fact, they seemed about as tall as Dorothy, who was a well-grown child for her age, although they were, so far as looks go, many years older.

Chapter III.
How Dorothy Saved the Scarecrow

When Dorothy was left alone she began to feel hungry. So she went to the cupboard and cut herself some bread, which she spread with butter. She gave some to Toto, and taking a pail from the shelf she carried it down to the little brook and filled it with clear, sparkling water. Toto ran over to the trees and began to bark at the birds sitting there. Dorothy went to get him, and saw such delicious fruit hanging from the branches that she gathered some of it, finding it just what she wanted to help out her breakfast.

Then she went back to the house, and having helped herself and Toto to a good drink of the cool, clear water, she set about making ready for the journey to the City of Emerald.

Dorothy had only one other dress, but that happened to be clean and was hanging on a peg beside her bed. It was gingham, with checks of white and blue; and although the blue was somewhat faded with many washings, it was still a pretty frock. The girl washed herself carefully, dressed herself in the clean gingham, and tied her pink sunbonnet on her head. She took a little basket and filled it with bread from the cupboard, laying a white cloth over the top. Then she looked down at her feet and noticed how old and worn her shoes were.

“They surely will never do for a long journey, Toto,” she said. And Toto looked up into her face with his little black eyes and wagged his tail to show he knew what she meant.

At that moment Dorothy saw lying on the table the silver shoes that had belonged to the Witch of the East.

“I wonder if they will fit me,” she said to Toto. “They would be just the thing to take a long walk in, for they could not wear out.”

She took off her old leather shoes and tried on the silver ones, which fitted her as well as if they had been made for her.

*** END OF THE PROJECT GUTENBERG EBOOK THE WONDERFUL WIZARD OF OZ ***

Updated editions will replace the previous one—the old editions will be renamed.

Creating the works from print editions not protected by U.S. copyright law means that no one owns a United States copyright in these works, so the Foundation (and you!) can copy and distribute it in the United States without permission and without paying copyright royalties.
`;

export type StepId =
  "strip" | "normalize" | "chapters" | "sentences" | "tokens" | "stopwords";

export const STEPS: { id: StepId; label: string }[] = [
  { id: "strip", label: "Strip header and footer" },
  { id: "normalize", label: "Normalize punctuation" },
  { id: "chapters", label: "Find chapters" },
  { id: "sentences", label: "Split sentences" },
  { id: "tokens", label: "Tokenize words" },
  { id: "stopwords", label: "Remove stopwords" },
];

export const STOPWORDS = (
  "a about after all also am an and any are as at be because been before being both but by " +
  "can could did do does don't down each for from had has have he her here hers herself him himself his how " +
  "i i'd i'll i'm i've if in into is it it's its itself just me more most my myself no nor not now of off on " +
  "once only or other our ours out over own same she should so some such than that that's the their theirs " +
  "them then there these they this those through to too under until up us very was we were what when where " +
  "which while who whom why will with would you your yours yourself"
).split(" ");
const STOP = new Set(STOPWORDS);

export interface Span {
  start: number;
  end: number;
}

// The patterns below are the ones the pipeline actually runs.
export const STRIP_RE =
  /^[\s\S]*?\*{3} START OF [^\n]*?\*{3}\s*|\s*\*{3} END OF [\s\S]*$/g;
export const NORMALIZE_RE = /[‘’]|[“”]|[ \t]*[–—][ \t]*|…|_|\r|[ \t]{2,}| /g;
export const CHAPTER_RE = /^Chapter[ \t]+([IVXLC]+)\.?[ \t]*\n+([^\n]+)\n*/gm;
export const SENTENCE_RE =
  /(?<!\b(?:Mr|Mrs|Ms|Dr|St)\.)(?<=[.!?]["'”’)]?)\s+(?=["'“‘(]?[A-Z])/g;
export const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
const SPACE_RUN_RE = /\S+/g;
export const STOPWORD_PATTERN = `\\b(?:${STOPWORDS.slice(0, 6).join("|")}|…)\\b`;

export interface StepReport {
  id: StepId;
  label: string;
  enabled: boolean;
  patterns: string[];
  before: string;
  after: string;
  beforeSpans: Span[];
  afterSpans: Span[];
  matches: number;
  unit: string;
}

export interface WordCount {
  word: string;
  count: number;
}

export interface SentenceLength {
  chapter: number;
  words: number;
}

export interface Pipeline {
  steps: StepReport[];
  labels: string[];
  lengths: SentenceLength[];
  lengthUnit: "sentence" | "paragraph";
  tokens: string[][];
  top: WordCount[];
  similarity: number[][];
  totals: {
    chapters: number;
    units: number;
    tokens: number;
    vocabulary: number;
    meanLength: number;
    longest: number;
  };
}

function replaceTracked(
  text: string,
  re: RegExp,
  fn: (match: string) => string,
) {
  let out = "";
  let last = 0;
  const before: Span[] = [];
  const after: Span[] = [];
  for (const m of text.matchAll(re)) {
    const index = m.index ?? 0;
    out += text.slice(last, index);
    const rep = fn(m[0]);
    before.push({ start: index, end: index + m[0].length });
    if (rep.length)
      after.push({ start: out.length, end: out.length + rep.length });
    out += rep;
    last = index + m[0].length;
  }
  return { text: out + text.slice(last), before, after };
}

function normalizeMatch(s: string): string {
  if (s === "‘" || s === "’") return "'";
  if (s === "“" || s === "”") return '"';
  if (s === "…") return "...";
  if (s === "_" || s === "\r") return "";
  if (/[–—]/.test(s)) return " - ";
  return " ";
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export function romanToNumber(roman: string): number {
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const v = ROMAN[roman[i]] ?? 0;
    const next = ROMAN[roman[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}

interface Line {
  kind: "marker" | "text" | "gap";
  text: string;
}

function layout(lines: Line[]) {
  const starts: number[] = [];
  let pos = 0;
  for (const line of lines) {
    starts.push(pos);
    pos += line.text.length + 1;
  }
  return { text: lines.map((l) => l.text).join("\n"), starts };
}

export function tokenize(text: string, regexOn = true): string[] {
  const re = regexOn ? WORD_RE : SPACE_RUN_RE;
  return [...text.matchAll(re)].map((m) =>
    regexOn ? m[0].toLowerCase() : m[0],
  );
}

export function isStopword(token: string): boolean {
  return STOP.has(token);
}

export function countWords(tokens: string[][], limit = 12): WordCount[] {
  const counts = new Map<string, number>();
  for (const doc of tokens)
    for (const t of doc) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

export function cosineSimilarity(a: string[], b: string[]): number {
  const ca = new Map<string, number>();
  const cb = new Map<string, number>();
  for (const t of a) ca.set(t, (ca.get(t) ?? 0) + 1);
  for (const t of b) cb.set(t, (cb.get(t) ?? 0) + 1);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, n] of ca) {
    na += n * n;
    dot += n * (cb.get(t) ?? 0);
  }
  for (const n of cb.values()) nb += n * n;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function similarityMatrix(docs: string[][]): number[][] {
  return docs.map((a, i) =>
    docs.map((b, j) => (i === j && a.length ? 1 : cosineSimilarity(a, b))),
  );
}

export function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let k = from; k < to; k++) sum += values[k];
    return sum / (to - from);
  });
}

export function runPipeline(
  raw: string,
  on: Partial<Record<StepId, boolean>> = {},
): Pipeline {
  const enabled: Record<StepId, boolean> = {
    strip: true,
    normalize: true,
    chapters: true,
    sentences: true,
    tokens: true,
    stopwords: true,
    ...on,
  };
  const label = (id: StepId) => STEPS.find((s) => s.id === id)!.label;
  const steps: StepReport[] = [];
  const report = (
    id: StepId,
    patterns: (RegExp | string)[],
    before: string,
    after: string,
    beforeSpans: Span[],
    afterSpans: Span[],
    unit: string,
  ) =>
    steps.push({
      id,
      label: label(id),
      enabled: enabled[id],
      patterns: patterns.map(String),
      before,
      after,
      beforeSpans: enabled[id] ? beforeSpans : [],
      afterSpans: enabled[id] ? afterSpans : [],
      matches: enabled[id] ? beforeSpans.length : 0,
      unit,
    });

  // 1. Strip header and footer
  const strip = enabled.strip
    ? replaceTracked(raw, STRIP_RE, () => "")
    : { text: raw, before: [], after: [] };
  report("strip", [STRIP_RE], raw, strip.text, strip.before, [], "removed");

  // 2. Normalize punctuation
  const norm = enabled.normalize
    ? replaceTracked(strip.text, NORMALIZE_RE, normalizeMatch)
    : { text: strip.text, before: [], after: [] };
  report(
    "normalize",
    [NORMALIZE_RE],
    strip.text,
    norm.text,
    norm.before,
    norm.after,
    "replaced",
  );

  // 3. Find chapters
  interface Chapter {
    roman: string;
    title: string;
    body: string;
  }
  let chapters: Chapter[] = [];
  const headings: Span[] = [];
  if (enabled.chapters) {
    const found = [...norm.text.matchAll(CHAPTER_RE)];
    found.forEach((m, i) => {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      headings.push({ start, end });
      const next = found[i + 1]?.index ?? norm.text.length;
      chapters.push({
        roman: m[1],
        title: m[2].trim(),
        body: norm.text.slice(end, next).trim(),
      });
    });
  }
  const real = chapters.length > 0;
  if (!real) chapters = [{ roman: "", title: "Full text", body: norm.text }];
  const markers = chapters.map(
    (c) => `§ ${romanToNumber(c.roman)} · ${c.title}`,
  );
  const chapterLines: Line[] = [];
  const bodyStart: number[] = [];
  const markerSpans: Span[] = [];
  {
    let pos = 0;
    chapters.forEach((c, i) => {
      if (real) {
        const marker = markers[i];
        markerSpans.push({ start: pos, end: pos + marker.length });
        chapterLines.push({ kind: "marker", text: marker });
        pos += marker.length + 1;
      }
      bodyStart.push(pos);
      chapterLines.push({ kind: "text", text: c.body });
      pos += c.body.length + 1;
      if (i < chapters.length - 1) {
        chapterLines.push({ kind: "gap", text: "" });
        pos += 1;
      }
    });
  }
  const chaptersText = layout(chapterLines).text;
  report(
    "chapters",
    [CHAPTER_RE],
    norm.text,
    real ? chaptersText : norm.text,
    headings,
    markerSpans,
    "chapters",
  );

  // 4. Split sentences (paragraphs when the step is off)
  const sentenceLines: Line[] = [];
  const boundaries: Span[] = [];
  const chapterOf: number[] = [];
  chapters.forEach((c, i) => {
    if (real) {
      sentenceLines.push({
        kind: "marker",
        text: markers[i],
      });
      chapterOf.push(i);
    }
    let units: string[];
    if (enabled.sentences) {
      units = [];
      let last = 0;
      for (const m of c.body.matchAll(SENTENCE_RE)) {
        const index = m.index ?? 0;
        units.push(c.body.slice(last, index));
        boundaries.push({
          start: bodyStart[i] + index,
          end: bodyStart[i] + index + m[0].length,
        });
        last = index + m[0].length;
      }
      units.push(c.body.slice(last));
    } else {
      units = c.body.split(/\n+/);
    }
    for (const u of units) {
      const text = u.replace(/\s+/g, " ").trim();
      if (!text) continue;
      sentenceLines.push({ kind: "text", text });
      chapterOf.push(i);
    }
    if (i < chapters.length - 1) {
      sentenceLines.push({ kind: "gap", text: "" });
      chapterOf.push(i);
    }
  });
  const sentences = layout(sentenceLines);
  const endSpans: Span[] = [];
  sentenceLines.forEach((line, i) => {
    if (line.kind !== "text" || !enabled.sentences) return;
    const m = /[.!?]["'”’)]?$/.exec(line.text);
    if (m)
      endSpans.push({
        start: sentences.starts[i] + (m.index ?? 0),
        end: sentences.starts[i] + line.text.length,
      });
  });
  report(
    "sentences",
    [SENTENCE_RE],
    real ? chaptersText : norm.text,
    sentences.text,
    boundaries,
    endSpans,
    "boundaries",
  );

  // 5. Tokenize words
  const tokenDocs: string[][] = chapters.map(() => []);
  const lengths: SentenceLength[] = [];
  const wordSpans: Span[] = [];
  sentenceLines.forEach((line, i) => {
    if (line.kind !== "text") return;
    const re = enabled.tokens ? WORD_RE : SPACE_RUN_RE;
    let count = 0;
    for (const m of line.text.matchAll(re)) {
      const start = sentences.starts[i] + (m.index ?? 0);
      wordSpans.push({ start, end: start + m[0].length });
      tokenDocs[chapterOf[i]].push(enabled.tokens ? m[0].toLowerCase() : m[0]);
      count++;
    }
    lengths.push({ chapter: chapterOf[i], words: count });
  });
  const tokenLayout = (docs: string[][]) => {
    const lines: Line[] = [];
    const offsets: number[][] = docs.map(() => []);
    let pos = 0;
    docs.forEach((doc, i) => {
      if (real) {
        const marker = markers[i];
        lines.push({ kind: "marker", text: marker });
        pos += marker.length + 1;
      }
      doc.forEach((t) => {
        offsets[i].push(pos);
        pos += t.length + 1;
      });
      lines.push({ kind: "text", text: doc.join(" ") });
      if (i < docs.length - 1) {
        lines.push({ kind: "gap", text: "" });
        pos += 1;
      }
    });
    return { text: layout(lines).text, offsets };
  };
  const tokenView = tokenLayout(tokenDocs);
  report(
    "tokens",
    [enabled.tokens ? WORD_RE : SPACE_RUN_RE],
    sentences.text,
    tokenView.text,
    wordSpans,
    [],
    "tokens",
  );
  const tokenOffsets = tokenView.offsets;

  // 6. Remove stopwords
  const removed: Span[] = [];
  const kept = tokenDocs.map((doc, i) =>
    doc.filter((t, j) => {
      if (enabled.stopwords && isStopword(t)) {
        const start = tokenOffsets[i][j];
        removed.push({ start, end: start + t.length });
        return false;
      }
      return true;
    }),
  );
  const keptView = tokenLayout(kept);
  report(
    "stopwords",
    [STOPWORD_PATTERN],
    tokenView.text,
    keptView.text,
    removed,
    [],
    "removed",
  );

  const labels = real
    ? chapters.map((c) => `Ch. ${c.roman}`)
    : chapters.map(() => "Text");
  const all = kept.flat();
  const lens = lengths.map((l) => l.words);
  return {
    steps,
    labels,
    lengths,
    lengthUnit: enabled.sentences ? "sentence" : "paragraph",
    tokens: kept,
    top: countWords(kept),
    similarity: similarityMatrix(kept),
    totals: {
      chapters: real ? chapters.length : 0,
      units: lengths.length,
      tokens: all.length,
      vocabulary: new Set(all).size,
      meanLength: lens.length
        ? lens.reduce((a, b) => a + b, 0) / lens.length
        : 0,
      longest: lens.length ? Math.max(...lens) : 0,
    },
  };
}
