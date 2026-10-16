export function runSampleAgent(
  question: string,
  profile: { sleep: number; stress: number },
) {
  const text = question.trim().toLowerCase();
  const intent = /why|reason|explain/.test(text)
    ? "reasoning"
    : /eat|food|meal|recipe|lunch/.test(text)
      ? "meal"
      : /sleep|tired|rest/.test(text)
        ? "sleep"
        : /stress|walk|move|activity/.test(text)
          ? "activity"
          : /plan|day|help/.test(text)
            ? "plan"
            : "unknown";
  const low = profile.sleep < 6 || profile.stress > 60;
  const meal = low
    ? "Spinach & Walnut Power Salad"
    : "Calming Chamomile Oat Bowl";
  const activity = low ? "a gentle 15-minute walk" : "a 30-minute walk";
  const reason = low
    ? "The sample sleep is below 6 hours or stress is above 60, so I picked low-effort options."
    : "The sample sleep and stress allow a longer movement break.";
  const answers = {
    meal: `Try the ${meal}. It is a quick, low-prep option.`,
    sleep: `You entered ${profile.sleep.toFixed(1)} hours of sleep. ${low ? "Keep this sample day simple: a quick meal and a short walk." : "The sample plan has room for a longer walk."}`,
    activity: `Try ${activity}. ${low ? "Keep the pace comfortable." : "Choose a time that suits the day."}`,
    reasoning: reason,
    plan: `For this sample day: ${meal} and ${activity}.`,
    unknown:
      "I can explain the sample meal, activity or plan. Try “What should I eat?” or “Why this plan?”",
  };
  const answer = answers[intent];
  const context = `sleep=${profile.sleep.toFixed(1)}h, stress=${profile.stress}/100`;
  const rule = low
    ? "low_effort: sleep < 6 OR stress > 60"
    : "regular: sleep >= 6 AND stress <= 60";
  return {
    intent,
    answer,
    meal,
    activity,
    low,
    trace: [
      {
        kicker: "Coordinator",
        title: "Route the question",
        copy: `Matched the ${intent} route using a fixed keyword table.`,
        input: question,
        output: `intent=${intent}`,
      },
      {
        kicker: "Signal analysis",
        title: "Read the current sample inputs",
        copy: "Read the sliders currently shown in the dashboard.",
        input: context,
        output: rule,
      },
      {
        kicker: "Catalog selection",
        title: "Choose from fixed sample options",
        copy: "Applied the local rule to choose a meal and an activity.",
        input: rule,
        output: `meal=${meal}; activity=${activity}`,
      },
      {
        kicker: "Validation",
        title: "Keep the answer within this demo",
        copy: "Only supported topics use a predefined answer; unknown questions receive a fallback.",
        input: `intent=${intent}`,
        output:
          intent === "unknown"
            ? "fallback / no unsupported answer"
            : "supported topic / predefined answer",
      },
      {
        kicker: "Reply",
        title: "Return the answer",
        copy: "This is the same response shown in the dashboard conversation.",
        input: `${intent} + ${context}`,
        output: answer,
      },
    ],
  };
}
