import {
  initialState,
  createDraft,
  editDraft,
  fingerprint,
  validateDraft,
  approveDraft,
  isApproved,
  publishDraft,
  issue,
} from "../../data/demos/proterra";

function init(root: HTMLElement) {
  let state = initialState();
  let invalidatedFingerprint: string | null = null;
  const query = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const all = <T extends HTMLElement>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];
  const title = query<HTMLInputElement>("[data-title]");
  const note = query<HTMLTextAreaElement>("[data-note]");
  const status = query<HTMLElement>("[data-status]");
  const stages = all<HTMLButtonElement>("[data-stage]");
  const announce = (message: string) => (status.textContent = message);

  function show(index: number) {
    all<HTMLElement>("[data-panel]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.panel) !== index;
    });
    stages.forEach((button, i) => {
      if (index === i) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    query<HTMLElement>(`[data-panel="${index}"]`).scrollTop = 0;
    const heading = query<HTMLElement>(`[data-panel="${index}"] h2`);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  function selectClaim(id: string) {
    all<HTMLButtonElement>("[data-claim]").forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.claim === id)),
    );
    all<HTMLElement>("[data-excerpt]").forEach((excerpt) => {
      const selected = excerpt.dataset.excerpt === id;
      excerpt.dataset.selected = String(selected);
      excerpt.hidden = !selected;
    });
  }

  function render() {
    const approved = isApproved(state);
    const errors = validateDraft(state);
    const published = Boolean(state.published);
    const version = fingerprint(state);
    stages[1].disabled = !state.draft;
    stages[2].disabled = !state.draft;
    stages[3].disabled = !state.draft;
    const labels = [
      state.collected ? "Collected" : "Ready",
      state.draft ? "Drafted" : "Pending",
      approved ? "Approved" : invalidatedFingerprint ? "Changed" : "Pending",
      published ? "Published" : "Pending",
    ];
    labels.forEach((label, i) => {
      query<HTMLElement>(`[data-step-status="${i}"]`).textContent = label;
    });
    query<HTMLButtonElement>("[data-create]").textContent = state.draft
      ? "Open draft ↗"
      : "Create draft ↗";
    query<HTMLElement>("[data-fingerprint]").textContent = version;
    query<HTMLElement>("[data-draft-title]").textContent =
      state.draft?.title ?? issue.title;
    const currentTitle = state.draft?.title ?? title.defaultValue;
    const currentNote = state.draft?.editorNote ?? note.defaultValue;
    if (title.value !== currentTitle) title.value = currentTitle;
    if (note.value !== currentNote) note.value = currentNote;
    title.readOnly = published;
    note.readOnly = published;
    query<HTMLElement>("[data-validation]").textContent = errors.length
      ? errors.join(" ")
      : "Passed: title present, 3 claims linked to collected evidence. Editorial accuracy requires review.";
    query<HTMLElement>("[data-approval-box]").dataset.approved =
      String(approved);
    query<HTMLElement>("[data-approval-label]").textContent = approved
      ? "Version approved"
      : invalidatedFingerprint
        ? "Approval invalidated"
        : "Awaiting approval";
    query<HTMLElement>("[data-approval-copy]").textContent = approved
      ? `Approval recorded for ${state.approval!.fingerprint}.`
      : invalidatedFingerprint
        ? `Approval for ${invalidatedFingerprint} is invalid. Review this version and approve it again.`
        : "Approval is tied to this exact draft version.";
    query<HTMLButtonElement>("[data-approve]").disabled =
      errors.length > 0 || approved || published;
    query<HTMLButtonElement>("[data-approve]").textContent = approved
      ? "Version approved"
      : invalidatedFingerprint
        ? "Approve revised version"
        : "Approve this version";
    query<HTMLButtonElement>("[data-open-publish]").disabled =
      !approved || errors.length > 0;
    query<HTMLButtonElement>("[data-publish]").disabled =
      !approved || errors.length > 0 || published;
    query<HTMLButtonElement>("[data-publish]").textContent = published
      ? "Published"
      : "Publish brief";
    query<HTMLElement>("[data-publish-heading]").textContent = published
      ? "Brief published"
      : approved
        ? "Ready for publication"
        : "Publication blocked";
    query<HTMLElement>("[data-publish-version]").textContent = version;
    query<HTMLElement>("[data-publish-gate]").textContent = published
      ? `Website updated. Email preview prepared from ${state.published!.fingerprint}.`
      : errors.length
        ? errors.join(" ")
        : approved
          ? "Validation passed. Approval matches this version."
          : "Publication blocked. The current version needs approval.";
    query<HTMLElement>("[data-previews]").hidden = !published;
    const publishedDraft = state.published?.draft;
    ["website-title", "email-title", "email-heading"].forEach((field) => {
      query<HTMLElement>(`[data-${field}]`).textContent =
        publishedDraft?.title ?? "";
    });
    ["website-note", "email-note"].forEach((field) => {
      query<HTMLElement>(`[data-${field}]`).textContent =
        publishedDraft?.editorNote ?? "";
    });
    if (publishedDraft)
      publishedDraft.claims.forEach((claim) => {
        all<HTMLElement>(`[data-published-claim="${claim.sourceId}"]`).forEach(
          (element) => {
            element.textContent = claim.text;
          },
        );
      });
  }

  stages.forEach((button, i) => {
    button.addEventListener("click", () => show(i));
  });
  query<HTMLButtonElement>("[data-create]").addEventListener("click", () => {
    if (!state.draft) state = createDraft(state);
    render();
    show(1);
    announce("Draft ready: 3 claims with supporting source passages.");
  });
  all<HTMLButtonElement>("[data-claim]").forEach((button) => {
    button.addEventListener("click", () => {
      selectClaim(button.dataset.claim!);
      const excerpt = query<HTMLElement>(
        `[data-excerpt="${button.dataset.claim}"]`,
      );
      announce(
        `Supporting passage highlighted: ${excerpt.querySelector("h4")!.textContent}.`,
      );
    });
  });
  all<HTMLAnchorElement>("[data-source-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      selectClaim(link.dataset.sourceLink!);
      const excerpt = query<HTMLElement>(
        `[data-excerpt="${link.dataset.sourceLink}"]`,
      );
      excerpt.tabIndex = -1;
      excerpt.focus();
      announce(
        `Supporting passage highlighted: ${excerpt.querySelector("h4")!.textContent}.`,
      );
    });
  });
  all<HTMLButtonElement>("[data-review-source]").forEach((button) => {
    button.addEventListener("click", () => {
      show(1);
      selectClaim(button.dataset.reviewSource!);
    });
  });
  query<HTMLButtonElement>("[data-review]").addEventListener("click", () =>
    show(2),
  );
  function edit(field: "title" | "editorNote", value: string) {
    if (state.draft?.[field] === value) return;
    if (isApproved(state)) invalidatedFingerprint = state.approval!.fingerprint;
    state = editDraft(state, field, value);
    render();
    announce(
      invalidatedFingerprint
        ? "Approval invalidated. The edited version must be approved again."
        : "Draft updated. Version fingerprint changed.",
    );
  }
  title.addEventListener("input", () => edit("title", title.value));
  note.addEventListener("input", () => edit("editorNote", note.value));
  query<HTMLButtonElement>("[data-approve]").addEventListener("click", () => {
    state = approveDraft(state);
    invalidatedFingerprint = null;
    render();
    announce(
      `Approved ${fingerprint(state)}. Editing the draft will invalidate approval.`,
    );
  });
  query<HTMLButtonElement>("[data-open-publish]").addEventListener(
    "click",
    () => show(3),
  );
  query<HTMLButtonElement>("[data-publish]").addEventListener("click", () => {
    state = publishDraft(state);
    render();
    announce(
      `Website updated and email preview ready for ${fingerprint(state)}.`,
    );
  });
  query<HTMLButtonElement>("[data-reset]").addEventListener("click", () => {
    state = initialState();
    invalidatedFingerprint = null;
    selectClaim("dairy");
    render();
    show(0);
    all<HTMLDetailsElement>("details").forEach(
      (detail) => (detail.open = false),
    );
    announce(
      "This week’s collection is ready: 3 stories from approved publications.",
    );
  });
  render();
}

document.querySelectorAll<HTMLElement>('[data-demo="proterra"]').forEach(init);
