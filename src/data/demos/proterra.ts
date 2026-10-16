export type Sector = "Dairy" | "Beef" | "Bovine genetics";
export type Item = {
  id: string;
  publication: string;
  url: string;
  date: string;
  sector: Sector | "Other";
  title: string;
  excerpt: string;
  claim: string;
};

export const issue = {
  date: "2026-10-12",
  start: "2026-10-05",
  end: "2026-10-11",
  title: "Weekly Brief / 12 October 2026",
};

// Public-domain editorial imagery, credited in the reference image library.
// Local derivatives are resized and cropped to 480 x 270. Story data is invented.
export const storyImages = {
  dairy: {
    src: "/assets/demos/proterra/dairy-parlor.webp",
    alt: "Dairy cows in a rotary milking parlor",
    author: "USDA Rural Development",
    license: "Public domain",
    source:
      "https://commons.wikimedia.org/wiki/File:20250813-USDA-RD-VA-JGP-0001_(54721557540).jpg",
  },
  beef: {
    src: "/assets/demos/proterra/cattle-market.webp",
    alt: "A commercial cattle herd gathered in an open pasture",
    author: "Keith Weller, USDA Agricultural Research Service",
    license: "Public domain",
    source: "https://commons.wikimedia.org/wiki/File:Cattle_herd.jpg",
  },
  genetics: {
    src: "/assets/demos/proterra/genetics-lab.webp",
    alt: "Laboratory technician pipetting a DNA sample",
    author: "National Institute of Standards and Technology",
    license: "Public domain",
    source:
      "https://commons.wikimedia.org/wiki/File:Laboratory_Technician_Pipettes_Dirt_(10714910404).jpg",
  },
};

export const publications = [
  { name: "Pasture & Pail Review", host: "dairy.example.com" },
  { name: "Cattle Market Ledger", host: "beef.example.com" },
  { name: "Herd Science Bulletin", host: "genetics.example.com" },
];

export const items: Item[] = [
  {
    id: "dairy",
    publication: publications[0].name,
    url: "https://dairy.example.com/october-milk-intake",
    date: "2026-10-09",
    sector: "Dairy",
    title: "Regional creameries report higher milk intake",
    excerpt:
      "The surveyed creameries received 12.4 million litres in September, compared with 12.1 million litres in August. The survey covers six creameries; it is not a national production estimate.",
    claim:
      "Milk intake at six surveyed creameries rose from 12.1 to 12.4 million litres between August and September.",
  },
  {
    id: "beef",
    publication: publications[1].name,
    url: "https://beef.example.com/weekly-cattle-offerings",
    date: "2026-10-08",
    sector: "Beef",
    title: "Auction offerings ease for a second week",
    excerpt:
      "The three reporting auctions offered 4,800 head in the week ending 7 October, down from 5,100 head a week earlier. These counts describe offerings, not completed sales or national cattle supply.",
    claim:
      "Offerings at three reporting auctions fell from 5,100 to 4,800 head week over week.",
  },
  {
    id: "genetics",
    publication: publications[2].name,
    url: "https://genetics.example.com/fertility-evaluation-pilot",
    date: "2026-10-07",
    sector: "Bovine genetics",
    title: "Fertility evaluation pilot opens enrolment",
    excerpt:
      "A pilot will compare a revised fertility evaluation with the current method across 20 participating herds. Enrolment opened on 7 October. No comparison results have been released.",
    claim:
      "A fertility evaluation pilot opened enrolment for 20 herds; results are not yet available.",
  },
  {
    id: "old",
    publication: publications[0].name,
    url: "https://dairy.example.com/august-cheese-output",
    date: "2026-09-18",
    sector: "Dairy",
    title: "August cheese output recap",
    excerpt: "An older publication outside this reporting window.",
    claim: "",
  },
  {
    id: "scope",
    publication: publications[1].name,
    url: "https://beef.example.com/poultry-processing",
    date: "2026-10-08",
    sector: "Other",
    title: "Poultry processing line opens",
    excerpt: "A new poultry processing line opened this week.",
    claim: "",
  },
  {
    id: "host",
    publication: "Field Rumour Wire",
    url: "https://rumour.example.com/unverified-breeding-claim",
    date: "2026-10-10",
    sector: "Bovine genetics",
    title: "Unverified breeding claim",
    excerpt: "An off-list link encountered during discovery.",
    claim: "",
  },
  {
    id: "duplicate",
    publication: publications[0].name,
    url: "https://dairy.example.com/october-milk-intake?utm_source=feed",
    date: "2026-10-09",
    sector: "Dairy",
    title: "Regional creameries report higher milk intake",
    excerpt: "The same release discovered through a second feed link.",
    claim: "",
  },
];

function canonicalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        /^(utm_.*|fbclid|gclid|p_auth|mc_cid|mc_eid|ref|ref_src|source)$/i.test(
          key,
        )
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    url.searchParams.sort();
    return url;
  } catch {
    return null;
  }
}

export function collectItems(input: Item[] = items) {
  const seen = new Set<string>();
  return input.map((item) => {
    const url = canonicalUrl(item.url);
    let reason = "Kept: approved publication, in window, in scope";
    let accepted = true;
    if (
      !url ||
      url.protocol !== "https:" ||
      !publications.some((publisher) => publisher.host === url.hostname)
    ) {
      reason = "Filtered: host is not on the allow-list";
      accepted = false;
    } else if (
      !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
      !Number.isFinite(Date.parse(item.date)) ||
      new Date(item.date).toISOString().slice(0, 10) !== item.date
    ) {
      reason = "Filtered: unparsable publication date";
      accepted = false;
    } else if (item.date < issue.start || item.date > issue.end) {
      reason = "Filtered: outside 5 to 11 October";
      accepted = false;
    } else if (item.sector === "Other") {
      reason = "Filtered: outside dairy, beef and bovine genetics";
      accepted = false;
    } else if (seen.has(url.href)) {
      reason = "Filtered: duplicate canonical URL";
      accepted = false;
    }
    if (accepted && url) seen.add(url.href);
    return { item, accepted, reason };
  });
}

export type Draft = {
  title: string;
  editorNote: string;
  claims: { text: string; sourceId: string }[];
};
type Approval = { version: number; snapshot: string; fingerprint: string };
export type Pipeline = {
  collected: boolean;
  draft: Draft | null;
  version: number;
  approval: Approval | null;
  published: { draft: Draft; fingerprint: string } | null;
};

// The scheduled collection has already completed when the editor opens this issue.
export function initialState(): Pipeline {
  return {
    collected: true,
    draft: null,
    version: 0,
    approval: null,
    published: null,
  };
}

export function collect(state: Pipeline): Pipeline {
  return { ...state, collected: true };
}

export function createDraft(state: Pipeline): Pipeline {
  if (!state.collected) throw new Error("Collect sources first.");
  if (state.published) throw new Error("This issue is already published.");
  return {
    ...state,
    version: state.version + 1,
    approval: null,
    published: null,
    draft: {
      title: issue.title,
      editorNote: "Public industry sources only.",
      claims: collectItems()
        .filter((result) => result.accepted)
        .map(({ item }) => ({ text: item.claim, sourceId: item.id })),
    },
  };
}

function snapshot(state: Pipeline) {
  return JSON.stringify({ issue: issue.date, draft: state.draft });
}

// A small local display hash. Approval also compares the full snapshot and version.
export function fingerprint(state: Pipeline) {
  let hash = 2166136261;
  for (const character of snapshot(state)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return `v${state.version}-${hash.toString(16).padStart(8, "0")}`;
}

export function editDraft(
  state: Pipeline,
  field: "title" | "editorNote",
  value: string,
): Pipeline {
  if (!state.draft) throw new Error("Create a draft first.");
  if (state.published) throw new Error("This issue is already published.");
  if (state.draft[field] === value) return state;
  return {
    ...state,
    draft: { ...state.draft, [field]: value },
    version: state.version + 1,
    approval: null,
  };
}

export function validateDraft(state: Pipeline): string[] {
  const draft = state.draft;
  if (!state.collected || !draft)
    return ["Collect sources and create a draft."];
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push("A brief title is required.");
  if (draft.title.length > 120)
    errors.push("Keep the title within 120 characters.");
  if (draft.editorNote.length > 280)
    errors.push("Keep the editorial note within 280 characters.");
  const kept = collectItems().filter((result) => result.accepted);
  if (
    draft.claims.length !== kept.length ||
    new Set(draft.claims.map((claim) => claim.sourceId)).size !== kept.length ||
    draft.claims.some(
      (claim) =>
        !kept.some(
          ({ item }) => item.id === claim.sourceId && item.claim === claim.text,
        ),
    )
  )
    errors.push("Each claim must match its collected source passage.");
  return errors;
}

export function isApproved(state: Pipeline) {
  return Boolean(
    state.approval &&
    state.approval.version === state.version &&
    state.approval.snapshot === snapshot(state),
  );
}

export function approveDraft(state: Pipeline): Pipeline {
  const errors = validateDraft(state);
  if (errors.length) throw new Error(errors.join(" "));
  return {
    ...state,
    approval: {
      version: state.version,
      snapshot: snapshot(state),
      fingerprint: fingerprint(state),
    },
  };
}

export function publishDraft(state: Pipeline): Pipeline {
  const errors = validateDraft(state);
  if (errors.length) throw new Error(errors.join(" "));
  if (!isApproved(state)) throw new Error("Approve the current version first.");
  if (state.published) return state;
  return {
    ...state,
    published: {
      draft: structuredClone(state.draft!),
      fingerprint: fingerprint(state),
    },
  };
}
