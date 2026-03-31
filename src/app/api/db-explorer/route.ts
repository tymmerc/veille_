import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USERS = ["tym_merc"]; // Only these users can access

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { username: true } });
  if (!user || !ADMIN_USERS.includes(user.username)) return null;
  return session;
}

// GET: list tables, table data, or row detail
export async function GET(request: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
  const sort = searchParams.get("sort") || "";
  const order = searchParams.get("order") === "asc" ? "asc" as const : "desc" as const;
  const search = searchParams.get("search") || "";
  const rowId = searchParams.get("id");

  // List all tables
  if (!table) {
    const [users, articles, likes, bookmarks, reads, friendships, shared, shareReplies, presets, promptHistory, notifLogs, pwResets] = await Promise.all([
      prisma.user.count(),
      prisma.article.count(),
      prisma.like.count(),
      prisma.bookmark.count(),
      prisma.articleRead.count(),
      prisma.friendship.count(),
      prisma.sharedArticle.count(),
      prisma.shareReply.count(),
      prisma.preset.count(),
      prisma.promptHistory.count(),
      prisma.notificationLog.count(),
      prisma.passwordReset.count(),
    ]);
    return NextResponse.json({
      tables: [
        { name: "users", count: users, icon: "👤" },
        { name: "articles", count: articles, icon: "📄" },
        { name: "likes", count: likes, icon: "❤️" },
        { name: "bookmarks", count: bookmarks, icon: "🔖" },
        { name: "article_reads", count: reads, icon: "👁" },
        { name: "friendships", count: friendships, icon: "🤝" },
        { name: "shared_articles", count: shared, icon: "📤" },
        { name: "share_replies", count: shareReplies, icon: "💬" },
        { name: "presets", count: presets, icon: "⚙️" },
        { name: "prompt_history", count: promptHistory, icon: "📝" },
        { name: "notification_logs", count: notifLogs, icon: "🔔" },
        { name: "password_resets", count: pwResets, icon: "🔑" },
      ],
    });
  }

  const skip = (page - 1) * limit;

  try {
    const result = await queryTable(table, { skip, limit, sort, order, search, rowId });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

// POST: raw SQL query
export async function POST(request: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const { sql } = await request.json();
  if (!sql || typeof sql !== "string") return NextResponse.json({ error: "SQL manquant" }, { status: 400 });

  // Block destructive queries
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith("DROP") || upper.startsWith("TRUNCATE") || upper.startsWith("ALTER")) {
    return NextResponse.json({ error: "Requete destructive interdite" }, { status: 403 });
  }

  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    return NextResponse.json({ rows, count: Array.isArray(rows) ? rows.length : 0 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

// DELETE: delete a row
export async function DELETE(request: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const { table, id } = await request.json();
  if (!table || !id) return NextResponse.json({ error: "table et id requis" }, { status: 400 });

  try {
    switch (table) {
      case "articles": await prisma.article.delete({ where: { id } }); break;
      case "likes": await prisma.like.delete({ where: { id } }); break;
      case "bookmarks": await prisma.bookmark.delete({ where: { id } }); break;
      case "article_reads": await prisma.articleRead.delete({ where: { id } }); break;
      case "friendships": await prisma.friendship.delete({ where: { id } }); break;
      case "shared_articles": await prisma.sharedArticle.delete({ where: { id } }); break;
      case "presets": await prisma.preset.delete({ where: { id } }); break;
      case "prompt_history": await prisma.promptHistory.delete({ where: { id } }); break;
      default: return NextResponse.json({ error: "Table non supportee" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

async function queryTable(table: string, opts: { skip: number; limit: number; sort: string; order: "asc" | "desc"; search: string; rowId: string | null }) {
  const { skip, limit, sort, order, search, rowId } = opts;

  switch (table) {
    case "users": {
      const where = search ? { OR: [{ username: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } : {};
      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where: rowId ? { id: rowId } : where,
          skip: rowId ? 0 : skip, take: rowId ? 1 : limit,
          orderBy: sort ? { [sort]: order } : { createdAt: "desc" },
          select: {
            id: true, username: true, email: true, discordId: true,
            prompt: true, promptConfig: true, scoringNotes: true,
            minScore: true, notifyEnabled: true, webhookUrl: true, slackWebhookUrl: true,
            syncHours: true, syncDays: true, isPublic: true, createdAt: true, updatedAt: true,
            _count: { select: { likes: true, bookmarks: true, reads: true, friendshipsSent: true, presets: true, promptHistory: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit), columns: ["id", "username", "email", "discordId", "prompt", "promptConfig", "minScore", "notifyEnabled", "webhookUrl", "isPublic", "createdAt", "_count"] };
    }
    case "articles": {
      const where = search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { source: { contains: search, mode: "insensitive" as const } }] } : {};
      const [rows, total] = await Promise.all([
        prisma.article.findMany({
          where: rowId ? { id: rowId } : where,
          skip: rowId ? 0 : skip, take: rowId ? 1 : limit,
          orderBy: sort ? { [sort]: order } : { foundAt: "desc" },
          select: {
            id: true, title: true, titleOriginal: true, url: true, summary: true,
            platform: true, source: true, score: true, category: true,
            isOfficial: true, foundAt: true,
            _count: { select: { likes: true, bookmarks: true } },
          },
        }),
        prisma.article.count({ where }),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit), columns: ["id", "title", "platform", "source", "score", "category", "isOfficial", "foundAt", "_count"] };
    }
    case "likes": {
      const [rows, total] = await Promise.all([
        prisma.like.findMany({
          skip, take: limit, orderBy: { createdAt: "desc" },
          include: { user: { select: { username: true } }, article: { select: { title: true } } },
        }),
        prisma.like.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "bookmarks": {
      const [rows, total] = await Promise.all([
        prisma.bookmark.findMany({
          skip, take: limit, orderBy: { createdAt: "desc" },
          include: { user: { select: { username: true } }, article: { select: { title: true } } },
        }),
        prisma.bookmark.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "article_reads": {
      const [rows, total] = await Promise.all([
        prisma.articleRead.findMany({
          skip, take: limit, orderBy: { createdAt: "desc" },
          include: { user: { select: { username: true } }, article: { select: { title: true } } },
        }),
        prisma.articleRead.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "friendships": {
      const [rows, total] = await Promise.all([
        prisma.friendship.findMany({
          skip, take: limit, orderBy: { createdAt: "desc" },
          include: { user: { select: { username: true } }, friend: { select: { username: true } } },
        }),
        prisma.friendship.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "shared_articles": {
      const [rows, total] = await Promise.all([
        prisma.sharedArticle.findMany({
          skip, take: limit, orderBy: { createdAt: "desc" },
          include: { from: { select: { username: true } }, to: { select: { username: true } }, article: { select: { title: true } } },
        }),
        prisma.sharedArticle.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "share_replies": {
      const [rows, total] = await Promise.all([
        prisma.shareReply.findMany({ skip, take: limit, orderBy: { createdAt: "desc" }, include: { user: { select: { username: true } } } }),
        prisma.shareReply.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "presets": {
      const [rows, total] = await Promise.all([
        prisma.preset.findMany({ skip, take: limit, orderBy: { createdAt: "desc" }, include: { user: { select: { username: true } } } }),
        prisma.preset.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "prompt_history": {
      const [rows, total] = await Promise.all([
        prisma.promptHistory.findMany({ skip, take: limit, orderBy: { createdAt: "desc" }, include: { user: { select: { username: true } } } }),
        prisma.promptHistory.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "notification_logs": {
      const [rows, total] = await Promise.all([
        prisma.notificationLog.findMany({ skip, take: limit, orderBy: { sentAt: "desc" } }),
        prisma.notificationLog.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    case "password_resets": {
      const [rows, total] = await Promise.all([
        prisma.passwordReset.findMany({ skip, take: limit, orderBy: { createdAt: "desc" } }),
        prisma.passwordReset.count(),
      ]);
      return { table, rows, total, page: Math.floor(skip / limit) + 1, pages: Math.ceil(total / limit) };
    }
    default:
      throw new Error("Table inconnue: " + table);
  }
}
