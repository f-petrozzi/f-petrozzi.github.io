// Interactive samples shown on project pages, keyed by project id. NüMe embeds its own sample.
export const demos: Record<string, () => Promise<{ default: any }>> = {
  autoclicker: () => import("./AutoclickerDemo.astro"),
  "hospital-data-warehouse": () => import("./HospitalWarehouseDemo.astro"),
  mongodb: () => import("./MongodbDemo.astro"),
  nest: () => import("./NestDemo.astro"),
  eduinsight: () => import("./EduinsightDemo.astro"),
  slice: () => import("./SliceDemo.astro"),
  "text-cleaning-analyzing": () => import("./TextCleaningDemo.astro"),
  "tixly-app-design": () => import("./TixlyDemo.astro"),
  "product-reviews-analysis": () => import("./ProductReviewsDemo.astro"),
  proterra: () => import("./ProterraDemo.astro"),
  "todoo-app": () => import("./TodooDemo.astro"),
};
