import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  description: string;
  tags: string[];
  coverImage: string | null;
  coverAlt: string | null;
  coverCaption: string | null;
  /** Draft posts (frontmatter `draft: true`) are excluded from the site —
      used for articles awaiting their final artwork before publishing. */
  draft: boolean;
  content: string;
}

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    return {
      slug: data.slug ?? file.replace(/\.mdx$/, ""),
      title: data.title ?? "Untitled",
      date: data.date ?? "",
      author: data.author ?? "Civica Team",
      description: data.description ?? "",
      tags: data.tags ?? [],
      coverImage: data.coverImage ?? null,
      coverAlt: data.coverAlt ?? null,
      coverCaption: data.coverCaption ?? null,
      draft: data.draft === true,
      content,
    };
  });
  // Drafts never render on the site; remove the `draft: true` flag to publish.
  return posts
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getPostBySlug(slug: string): BlogPost | null {
  const posts = getAllPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}
