import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ExportArticle = {
  title: string;
  url: string;
  category: string;
  score: number;
  source: string;
  summary: string;
  savedAt: string;
};

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCSV(articles: ExportArticle[]): string {
  const header = "title,url,category,score,source,summary,savedAt";
  const rows = articles.map((a) =>
    [
      escapeCsv(a.title),
      escapeCsv(a.url),
      escapeCsv(a.category),
      String(a.score),
      escapeCsv(a.source),
      escapeCsv(a.summary || ""),
      escapeCsv(a.savedAt),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

function toMarkdown(articles: ExportArticle[]): string {
  const grouped: Record<string, ExportArticle[]> = {};
  for (const a of articles) {
    const cat = a.category || "autre";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  }

  const categoryLabels: Record<string, string> = {
    ia: "IA",
    cyber: "Cyber",
    dev: "Dev",
    tech: "Tech",
    autre: "Autre",
  };

  let md = "# Mes articles sauvegardes\n";

  for (const [cat, items] of Object.entries(grouped)) {
    md += `\n## ${categoryLabels[cat] || cat}\n`;
    for (const a of items) {
      const hook = a.summary ? a.summary.split("\n")[0].slice(0, 120) : "";
      md += `- [${a.title}](${a.url}) - ${a.score}/10 - ${a.source}\n`;
      if (hook) md += `  > ${hook}\n`;
    }
  }

  return md;
}

export async function GET(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  if (!["json", "csv", "markdown"].includes(format)) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      article: {
        select: {
          title: true,
          url: true,
          category: true,
          score: true,
          source: true,
          summary: true,
        },
      },
    },
  });

  const articles: ExportArticle[] = bookmarks.map((b) => ({
    title: b.article.title,
    url: b.article.url,
    category: b.article.category,
    score: b.article.score,
    source: b.article.source,
    summary: b.article.summary || "",
    savedAt: b.createdAt.toISOString(),
  }));

  if (format === "csv") {
    return new NextResponse(toCSV(articles), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=bookmarks.csv",
      },
    });
  }

  if (format === "markdown") {
    return new NextResponse(toMarkdown(articles), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=bookmarks.md",
      },
    });
  }

  // JSON
  return new NextResponse(JSON.stringify(articles, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=bookmarks.json",
    },
  });
 } catch (error) {
  console.error(`[API Error] GET /api/bookmarks/export:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
