// Interactive samples shown on project pages, keyed by project id. NüMe embeds its own sample.
export const demos: Record<string, () => Promise<{ default: any }>> = {
  nest: () => import("./NestDemo.astro"),
  eduinsight: () => import("./EduinsightDemo.astro"),
  "tixly-app-design": () => import("./TixlyDemo.astro"),
  proterra: () => import("./ProterraDemo.astro"),
};
