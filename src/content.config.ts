import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    tools: z.array(z.string()),
    order: z.number(),
    featured: z.boolean().default(false),
    status: z.string(),
    visual: z.string().default("code"),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
  }),
});
export const collections = { projects };
