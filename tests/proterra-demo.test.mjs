import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  items,
  storyImages,
  collectItems,
  initialState,
  createDraft,
  editDraft,
  fingerprint,
  validateDraft,
  approveDraft,
  isApproved,
  publishDraft,
} from "../src/data/demos/proterra.ts";

const draft = () => createDraft(initialState());

test("every collected story has a credited local WebP thumbnail within 30 KB", () => {
  const kept = collectItems().filter((row) => row.accepted);
  assert.equal(kept.length, 3);
  for (const { item } of kept) {
    const image = storyImages[item.id];
    assert.ok(image.alt && image.author);
    assert.equal(image.license, "Public domain");
    assert.equal(new URL(image.source).hostname, "commons.wikimedia.org");
    assert.match(image.src, /^\/assets\/demos\/proterra\/[a-z-]+\.webp$/);
    const bytes = readFileSync(
      new URL(`../public${image.src}`, import.meta.url),
    );
    assert.ok(bytes.length <= 30_000, `${image.src} exceeds 30 KB`);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  }
});

test("collection explains allow-list, date, scope and canonical duplicate decisions", () => {
  const results = collectItems();
  assert.deepEqual(results, collectItems());
  assert.deepEqual(
    results.filter((row) => row.accepted).map((row) => row.item.id),
    ["dairy", "beef", "genetics"],
  );
  for (const [id, reason] of [
    ["host", /allow-list/],
    ["old", /outside 5 to 11/],
    ["scope", /outside dairy/],
    ["duplicate", /duplicate canonical/],
  ]) {
    const row = results.find((row) => row.item.id === id);
    assert.equal(row.accepted, false);
    assert.match(row.reason, reason);
  }
  assert.ok(
    items.every((item) => new URL(item.url).hostname.endsWith(".example.com")),
  );
  const spoof = {
    ...items[0],
    url: "https://dairy.example.com.evil.example.com/story",
  };
  assert.equal(collectItems([spoof])[0].accepted, false);
});

test("the weekly source set is ready on arrival and after reset", () => {
  const state = initialState();
  assert.equal(state.collected, true);
  assert.equal(state.draft, null);
  const prepared = createDraft(state);
  assert.equal(prepared.draft.claims.length, 3);
  assert.equal(state.draft, null);
  assert.deepEqual(initialState(), state);
});

test("drafting requires collection and each claim retains its exact evidence reference", () => {
  assert.throws(
    () => createDraft({ ...initialState(), collected: false }),
    /Collect sources/,
  );
  const state = draft();
  assert.deepEqual(validateDraft(state), []);
  for (const claim of state.draft.claims) {
    const source = items.find((item) => item.id === claim.sourceId);
    assert.equal(claim.text, source.claim);
    assert.ok(source.excerpt.length > 40);
  }
  assert.throws(() => publishDraft(state), /Approve the current version/);
});

test("collection rejects invalid sources and dates while preserving distinct releases", () => {
  const source = items[0];
  for (const url of ["broken-url", "http://dairy.example.com/release"]) {
    const [result] = collectItems([{ ...source, url }]);
    assert.equal(result.accepted, false);
    assert.match(result.reason, /allow-list/);
  }
  for (const date of ["", "unknown", "2026-02-30", "2026-10-07T00:00:00Z"]) {
    const [result] = collectItems([{ ...source, date }]);
    assert.equal(result.accepted, false);
    assert.match(result.reason, /unparsable publication date/);
  }
  for (const date of ["2026-10-05", "2026-10-11"]) {
    assert.equal(collectItems([{ ...source, date }])[0].accepted, true);
  }
  for (const date of ["2026-10-04", "2026-10-12"]) {
    assert.equal(collectItems([{ ...source, date }])[0].accepted, false);
  }
  const releases = collectItems([
    { ...source, url: "https://dairy.example.com/release?id=one" },
    { ...source, url: "https://dairy.example.com/release?id=two" },
    {
      ...source,
      url: "https://www.dairy.example.com//release/?utm_source=feed&id=one#text",
    },
  ]);
  assert.deepEqual(
    releases.map((row) => row.accepted),
    [true, true, false],
  );
  assert.match(releases[2].reason, /duplicate canonical URL/);
});

test("approval is invalidated immediately by edits, even when the text is restored", () => {
  const original = draft();
  const approved = approveDraft(original);
  assert.equal(isApproved(approved), true);
  const changed = editDraft(
    approved,
    "editorNote",
    "Reviewed against the source passages.",
  );
  assert.equal(changed.approval, null);
  assert.equal(isApproved(changed), false);
  assert.notEqual(fingerprint(changed), fingerprint(approved));
  assert.throws(() => publishDraft(changed), /Approve the current version/);
  const restored = editDraft(changed, "editorNote", original.draft.editorNote);
  assert.equal(isApproved(restored), false);
  assert.notEqual(fingerprint(restored), fingerprint(original));
  assert.equal(isApproved({ ...changed, approval: approved.approval }), false);
  const tampered = {
    ...approved,
    draft: { ...approved.draft, title: "Different title" },
  };
  assert.equal(isApproved(tampered), false);
  assert.equal(editDraft(approved, "title", approved.draft.title), approved);
});

test("validation blocks blank titles and unsupported or duplicate claims", () => {
  const blank = editDraft(draft(), "title", "   ");
  assert.match(validateDraft(blank).join(), /title is required/);
  assert.throws(() => approveDraft(blank), /title is required/);
  const state = draft();
  state.draft.claims[0].sourceId = "host";
  assert.match(validateDraft(state).join(), /source passage/);
  assert.throws(() => approveDraft(state), /source passage/);
  const duplicate = draft();
  duplicate.draft.claims[1] = duplicate.draft.claims[0];
  assert.match(validateDraft(duplicate).join(), /source passage/);
  const unsupported = draft();
  unsupported.draft.claims[0].text = "An invented national trend";
  assert.throws(() => approveDraft(unsupported), /source passage/);
  assert.throws(
    () => approveDraft(editDraft(draft(), "editorNote", "x".repeat(281))),
    /280 characters/,
  );
});

test("reapproval publishes an independent copy of the exact reviewed snapshot", () => {
  const approved = approveDraft(
    editDraft(approveDraft(draft()), "title", "Agricultural signals / October"),
  );
  const published = publishDraft(approved);
  assert.equal(published.published.fingerprint, approved.approval.fingerprint);
  assert.deepEqual(published.published.draft, approved.draft);
  assert.notEqual(published.published.draft, approved.draft);
  assert.equal(publishDraft(published), published);
  assert.throws(
    () => editDraft(published, "title", "New title"),
    /already published/,
  );
  assert.throws(() => createDraft(published), /already published/);
  approved.draft.claims[0].text = "A later mutation";
  assert.notEqual(published.published.draft.claims[0].text, "A later mutation");
  assert.throws(() => publishDraft(published), /source passage/);
  const reset = initialState();
  assert.equal(reset.collected, true);
  assert.equal(reset.draft, null);
  assert.equal(reset.approval, null);
  assert.equal(reset.published, null);
});
