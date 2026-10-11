import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/session";
import {
  deleteUserData,
  updateProfile,
} from "@/server/db/repositories/users";
import { fail } from "@/server/http/errors";

/**
 * GET / PUT / DELETE /api/profile — the app's own copy of the profile.
 * Ports Express `GET /profile` + `PUT /profile` (`backend/routes/userRoute.js`):
 * same editable fields (`fname`, `lname`, `userInterest`, `userAddress`),
 * same read-only identity (`authId`, `email` from the Better Auth cookie).
 * Trips intentionally stay out: they live in `trips` and are read through
 * `GET /api/trips`, never back inside `user.recentSearch`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toProfile = (user: {
  authId: string;
  email: string;
  fname: string;
  lname?: string;
  userInterest: string[];
  userAddress: string;
}) => ({
  authId: user.authId,
  email: user.email,
  fname: user.fname,
  lname: user.lname ?? "",
  userInterest: user.userInterest ?? [],
  userAddress: user.userAddress ?? "",
});

export async function GET() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) {
    return fail("UNAUTHENTICATED", "Sign in to see your profile");
  }
  return NextResponse.json(toProfile(viewer.user));
}

export async function PUT(request: Request) {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) {
    return fail("UNAUTHENTICATED", "Sign in to update your profile");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("BAD_INPUT", "Request body must be JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("BAD_INPUT", "Request body must be JSON");
  }
  const patch = body as {
    fname?: unknown;
    lname?: unknown;
    userInterest?: unknown;
    userAddress?: unknown;
  };

  if (
    (patch.fname !== undefined && typeof patch.fname !== "string") ||
    (patch.lname !== undefined && typeof patch.lname !== "string") ||
    (patch.userInterest !== undefined && !Array.isArray(patch.userInterest)) ||
    (patch.userAddress !== undefined && typeof patch.userAddress !== "string")
  ) {
    return fail("BAD_INPUT", "Profile fields have the wrong shape", [
      { path: "profile", message: "fname/lname/userAddress must be strings, userInterest an array." },
    ]);
  }

  if (
    Array.isArray(patch.userInterest) &&
    patch.userInterest.some((v) => typeof v !== "string")
  ) {
    return fail("BAD_INPUT", "Profile fields have the wrong shape", [
      { path: "userInterest", message: "Every interest must be a string." },
    ]);
  }

  if (typeof patch.fname === "string" && !patch.fname.trim()) {
    return fail("BAD_INPUT", "A name is required", [
      { path: "fname", message: "Enter how you want to be called." },
    ]);
  }

  try {
    const updated = await updateProfile(viewer.identity.authId, {
      fname: typeof patch.fname === "string" ? patch.fname : undefined,
      lname: typeof patch.lname === "string" ? patch.lname : undefined,
      userInterest: Array.isArray(patch.userInterest)
        ? (patch.userInterest as string[])
        : undefined,
      userAddress:
        typeof patch.userAddress === "string" ? patch.userAddress : undefined,
    });
    if (!updated) return fail("NOT_FOUND", "No profile for this account");
    return NextResponse.json(toProfile(updated));
  } catch {
    return fail("INTERNAL", "Could not save your profile right now");
  }
}

export async function DELETE() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) {
    return fail("UNAUTHENTICATED", "Sign in to delete your account");
  }
  try {
    await deleteUserData(viewer.identity.authId);
    return NextResponse.json({ ok: true });
  } catch {
    return fail("INTERNAL", "Could not delete your account right now");
  }
}
