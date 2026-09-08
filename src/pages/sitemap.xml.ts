import { getCollection } from "astro:content";
export async function GET() {
  const projects = await getCollection("projects");
  const paths = ["/", ...projects.map((project) => `/projects/${project.id}/`)];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>https://petrozzi.dev${path}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
