import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";

// The session cookie is set on Domain=.shrijit.tech, so it arrives on every API
// call: forward it to the shared Better Auth service and mirror the user into
// this app's own profile document.
const AUTH_URL = process.env.AUTH_URL || "https://auth.shrijit.tech";

// TripTribe is an org on the shared auth service: a valid session alone is not
// entry. Membership self-joins on first visit (open signup); false only when
// the hub is unreachable, the org is unseeded, or TripTribe later flips to
// invite-only.
async function ensureMembership(cookie) {
    const call = (path, init) =>
        fetch(`${AUTH_URL}${path}`, { ...init, headers: { cookie }, cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
    const member = await call("/api/orgs/triptribe/member");
    if (member?.member) return true;
    const joined = await call("/api/orgs/triptribe/join", { method: "POST" });
    return Boolean(joined?.member);
}

const authenticate = asyncHandler(async (req, res, next) => {
    const cookie = req.headers.cookie || "";
    if (!cookie.includes("better-auth.session_token")) {
        return res.status(401).json({ message: "Not authorized, no session." });
    }

    const session = await fetch(`${AUTH_URL}/api/auth/get-session`, {
        headers: { cookie },
        cache: "no-store",
    })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    const sessionUser = session?.user;
    if (!sessionUser?.id) {
        return res.status(401).json({ message: "Not authorized, session failed." });
    }

    if (!(await ensureMembership(cookie))) {
        return res.status(401).json({ message: "Not authorized for TripTribe." });
    }

    const user = await User.findOneAndUpdate(
        { authId: sessionUser.id },
        {
            $setOnInsert: {
                authId: sessionUser.id,
                email: sessionUser.email,
                fname: sessionUser.name?.split(" ")[0] || sessionUser.email,
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    req.user = user;
    req.sessionUser = sessionUser;
    next();
});

export { authenticate };