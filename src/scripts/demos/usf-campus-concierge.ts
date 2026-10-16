import {
  ask,
  draftEmail,
  emailCall,
  latency,
  meetingCall,
  prompts,
  type Reply,
} from "../../data/demos/usf-campus-concierge";

function init(root: HTMLElement) {
  const get = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const question = get<HTMLInputElement>("[data-question]");
  let reply: Reply = ask(prompts[0]);
  const draftTo = get<HTMLInputElement>("[data-email-to]");
  const draftSubject = get<HTMLInputElement>("[data-email-subject]");
  const draftBody = get<HTMLTextAreaElement>("[data-email-body]");
  function selectPassage(id: number) {
    root.querySelectorAll<HTMLElement>("[data-passage]").forEach((item) => {
      const selected = Number(item.dataset.passage) === id;
      item.classList.toggle("selected", selected);
      if (selected) {
        item.focus({ preventScroll: true });
        item.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    });
  }
  function showLatency(action: "none" | "email" | "calendar") {
    const times = latency(reply, action);
    const total = times.retrieve + times.generate + times.tool;
    get("[data-total]").textContent = `${total} ms`;
    for (const key of ["retrieve", "generate", "tool"] as const) {
      get(`[data-duration="${key}"]`).textContent = `${times[key]} ms`;
      get(`[data-bar="${key}"]`).style.width = `${(times[key] / total) * 100}%`;
    }
  }
  function showCall(
    call: ReturnType<typeof emailCall> | ReturnType<typeof meetingCall>,
  ) {
    get("[data-tool]").hidden = false;
    get("[data-tool-name]").textContent = call.tool;
    get("[data-tool-args]").textContent = JSON.stringify(
      call.arguments,
      null,
      2,
    );
    get("[data-tool-result]").textContent = JSON.stringify(
      call.result,
      null,
      2,
    );
  }
  function action(name: string) {
    root
      .querySelectorAll<HTMLElement>("[data-action-panel]")
      .forEach((panel) => (panel.hidden = panel.dataset.actionPanel !== name));
    root
      .querySelectorAll<HTMLButtonElement>("[data-action]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.action === name),
        ),
      );
  }
  function clearSlots() {
    root
      .querySelectorAll<HTMLButtonElement>("[data-slot]")
      .forEach((button) => button.setAttribute("aria-pressed", "false"));
    get("[data-slot-status]").textContent =
      "6 available slots · 30 minutes · Eastern time";
  }
  function render() {
    get("[data-last-question]").textContent = reply.question;
    const answer = get("[data-answer]");
    answer.replaceChildren();
    if (!reply.answer.length) answer.textContent = reply.fallback;
    for (const part of reply.answer) {
      const paragraph = document.createElement("p");
      paragraph.append(document.createTextNode(`${part.text} `));
      const citation = document.createElement("button");
      citation.type = "button";
      citation.className = "citation";
      citation.textContent = `[${part.number}]`;
      citation.setAttribute(
        "aria-label",
        `Citation ${part.number}: ${reply.citations[part.number - 1].title}`,
      );
      citation.addEventListener("click", () => selectPassage(part.passageId));
      paragraph.append(citation);
      answer.append(paragraph);
    }
    get("[data-passages]").replaceChildren(
      ...reply.ranked.map((passage, index) => {
        const article = document.createElement("article");
        article.dataset.passage = String(passage.id);
        article.tabIndex = -1;
        const citation = reply.citations.findIndex((p) => p.id === passage.id);
        if (citation !== -1) article.dataset.cited = "true";
        const title = document.createElement("h4");
        title.textContent = `${citation === -1 ? `${index + 1}.` : `[${citation + 1}]`} ${passage.title}`;
        const score = document.createElement("span");
        score.className = "score";
        score.textContent = `Similarity ${(passage.score * 100).toFixed(1)}%${citation !== -1 ? " · cited" : ""}`;
        const text = document.createElement("p");
        text.textContent = passage.text;
        article.append(title, score, text);
        return article;
      }),
    );
    get("[data-retrieval-status]").textContent =
      `${reply.citations.length} cited / 12 passages ranked`;
    root
      .querySelectorAll<HTMLButtonElement>("[data-prompt]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.prompt === reply.question),
        ),
      );
    action("");
    get("[data-tool]").hidden = true;
    get("[data-tool-name]").textContent = "";
    get("[data-tool-args]").textContent = "";
    get("[data-tool-result]").textContent = "";
    draftTo.value = "";
    draftSubject.value = "";
    draftBody.value = "";
    clearSlots();
    showLatency("none");
  }
  const form = get<HTMLFormElement>("[data-question-form]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!question.value.trim()) return;
    reply = ask(question.value);
    render();
  });
  root.querySelectorAll<HTMLButtonElement>("[data-prompt]").forEach((button) =>
    button.addEventListener("click", () => {
      question.value = button.dataset.prompt!;
      form.requestSubmit();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) =>
    button.addEventListener("click", () => {
      const name = button.dataset.action!;
      action(name);
      if (name === "email") {
        const draft = draftEmail(reply);
        draftTo.value = draft.to;
        draftSubject.value = draft.subject;
        draftBody.value = draft.body;
        showCall(emailCall(draft));
        showLatency("email");
      } else {
        clearSlots();
        showCall(meetingCall(reply));
        showLatency("calendar");
      }
    }),
  );
  [draftTo, draftSubject, draftBody].forEach((input) =>
    input.addEventListener("input", () =>
      showCall(
        emailCall({
          to: draftTo.value,
          subject: draftSubject.value,
          body: draftBody.value,
        }),
      ),
    ),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach((button) =>
    button.addEventListener("click", () => {
      root
        .querySelectorAll<HTMLButtonElement>("[data-slot]")
        .forEach((other) =>
          other.setAttribute("aria-pressed", String(other === button)),
        );
      showCall(
        meetingCall(reply, {
          date: button.dataset.date!,
          time: button.dataset.time!,
        }),
      );
      get("[data-slot-status]").textContent =
        `Proposed: ${button.dataset.date} at ${button.dataset.time} Eastern · invitation pending`;
      showLatency("calendar");
    }),
  );
  get("[data-reset]").addEventListener("click", () => {
    question.value = prompts[0];
    reply = ask(prompts[0]);
    render();
    get("[data-passages]").scrollTop = 0;
    root
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach((detail) => (detail.open = false));
  });
  render();
}
document
  .querySelectorAll<HTMLElement>('[data-demo="usf-campus-concierge"]')
  .forEach(init);
