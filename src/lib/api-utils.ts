import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Structured JSON error response.
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Parse and validate request body with a Zod schema.
 * Returns parsed data or a NextResponse error.
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Corps de requete invalide", 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0] as { message: string; code?: string; path?: (string | number)[] };
    let msg = issue?.message || "Donnees invalides";
    // Better message for missing fields (Zod v4 gives generic "Invalid input" for undefined)
    if (issue?.code === "invalid_type" && issue.path && issue.path.length > 0) {
      msg = `Champ "${issue.path[issue.path.length - 1]}" requis`;
    }
    return apiError(msg, 400);
  }
  return result.data;
}

/**
 * Check if a value is a NextResponse (error from parseBody).
 */
export function isApiError(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/**
 * Wrap an API handler with try/catch for consistent error handling.
 */
export function withErrorHandler(
  handler: (request: Request, context?: unknown) => Promise<NextResponse>,
) {
  return async (request: Request, context?: unknown) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`[API Error] ${request.method} ${request.url}:`, error);
      return apiError("Erreur interne du serveur", 500);
    }
  };
}

// ─── Shared Zod schemas ──────────────────────────────────────────

export const emailSchema = z
  .string()
  .min(1, "Email requis")
  .email("Adresse email invalide")
  .transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(6, "Le mot de passe doit contenir au moins 6 caracteres");

export const usernameSchema = z
  .string()
  .min(3, "Le nom d'utilisateur doit contenir au moins 3 caracteres")
  .max(20, "Le nom d'utilisateur ne doit pas depasser 20 caracteres")
  .regex(/^[a-zA-Z0-9_-]+$/, "Uniquement lettres, chiffres, _ ou -")
  .transform((v) => v.trim());
