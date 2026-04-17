import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const legacyPath = path.join(root, "backend", "data", "links.json");
const outputPath = path.join(root, "data", "navigation-store.migrated.json");

const categoryLookup = {
  Google: "cat-search",
  Bing: "cat-search",
  ChatGPT: "cat-ai",
  Figma: "cat-design",
  Dribbble: "cat-design",
  GitHub: "cat-dev",
  "Stack Overflow": "cat-dev",
  "MDN Web Docs": "cat-dev",
  Vercel: "cat-dev",
  Notion: "cat-productivity"
};

const iconLookup = {
  Google: "search",
  Bing: "compass",
  ChatGPT: "spark",
  Figma: "grid",
  Dribbble: "palette",
  GitHub: "terminal",
  "Stack Overflow": "code",
  "MDN Web Docs": "book",
  Vercel: "rocket",
  Notion: "note"
};

const defaultCategories = [
  {
    id: "cat-search",
    name: "搜索发现",
    slug: "search-discovery",
    description: "高频搜索入口与快速检索站点。",
    sortOrder: 1
  },
  {
    id: "cat-ai",
    name: "AI 工具",
    slug: "ai-tools",
    description: "聊天、生成、研究与创作类 AI 网站。",
    sortOrder: 2
  },
  {
    id: "cat-design",
    name: "设计灵感",
    slug: "design-inspiration",
    description: "设计协作、灵感采集与作品展示站点。",
    sortOrder: 3
  },
  {
    id: "cat-video",
    name: "影视娱乐",
    slug: "video-entertainment",
    description: "影片资料、追剧记录和影视发现站点。",
    sortOrder: 4
  },
  {
    id: "cat-dev",
    name: "开发工具",
    slug: "developer-tools",
    description: "开发、部署、文档与工程协作工具。",
    sortOrder: 5
  },
  {
    id: "cat-productivity",
    name: "效率协作",
    slug: "productivity",
    description: "记录、组织与团队节奏管理工具。",
    sortOrder: 6
  }
];

async function readLegacyLinks() {
  const raw = await fs.readFile(legacyPath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.links) ? parsed.links : [];
}

function sanitizeDescription(title, description) {
  if (typeof description !== "string") {
    return `${title} 导航站点`;
  }

  const cleaned = description
    .replace(/[^\u0000-\u007F\u4E00-\u9FFFa-zA-Z0-9，。、“”！？；：\s\-/.]/g, "")
    .trim();

  return cleaned || `${title} 导航站点`;
}

async function main() {
  const legacyLinks = await readLegacyLinks();

  const links = legacyLinks.map((link, index) => ({
    id: `legacy-${link.id ?? index + 1}`,
    title: link.title,
    url: link.url,
    description: sanitizeDescription(link.title, link.description),
    icon: iconLookup[link.title] ?? "globe",
    categoryId: categoryLookup[link.title] ?? "cat-productivity",
    featured: index < 5,
    sortOrder: index + 1,
    createdAt: link.createdAt ?? new Date().toISOString(),
    updatedAt: link.createdAt ?? new Date().toISOString()
  }));

  const output = {
    categories: defaultCategories,
    links,
    settings: {
      id: "singleton",
      siteName: "Nav Atlas",
      heroTitle: "FIND WHAT'S USEFUL.",
      heroSubtitle: "按分类浏览 AI、设计、影视与高频工具网站。",
      accentColor: "#2563EB",
      defaultTheme: "light",
      adminBranding: "Nav Atlas Control"
    }
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Migrated ${links.length} legacy links to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
