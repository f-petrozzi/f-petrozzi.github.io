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
    ? "Sleep is below 6 hours or stress is above 60. I picked low-effort options."
    : "Sleep and stress allow a longer walk.";
  const answers = {
    meal: `Try the ${meal} for a quick meal.`,
    sleep: `You entered ${profile.sleep.toFixed(1)} hours of sleep. ${low ? "Try a quick meal and short walk." : "The plan allows a longer walk."}`,
    activity: `Try ${activity}. ${low ? "Keep the pace comfortable." : "Choose a time that suits the day."}`,
    reasoning: reason,
    plan: `Today’s plan is ${meal} and ${activity}.`,
    unknown: "Ask about the sample meal, activity or plan.",
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
        copy: `Routed the ${intent} request.`,
        input: question,
        output: `intent=${intent}`,
      },
      {
        kicker: "Signal analysis",
        title: "Read daily inputs",
        copy: "Read dashboard sleep and stress.",
        input: context,
        output: rule,
      },
      {
        kicker: "Catalog selection",
        title: "Choose meal and activity",
        copy: "Selected a meal and activity for the daily profile.",
        input: rule,
        output: `meal=${meal} / activity=${activity}`,
      },
      {
        kicker: "Validation",
        title: "Validate the answer",
        copy: "Answer supported topics. Use a fallback for unknown questions.",
        input: `intent=${intent}`,
        output:
          intent === "unknown"
            ? "fallback / no unsupported answer"
            : "supported topic / predefined answer",
      },
      {
        kicker: "Reply",
        title: "Return the answer",
        copy: "Return the dashboard reply.",
        input: `${intent} + ${context}`,
        output: answer,
      },
    ],
  };
}
