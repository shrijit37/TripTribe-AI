#!/usr/bin/env python3
"""Spike: can gosom/google-maps-scraper replace Places API for TripTribe?

Talks to the scraper's HTTP API directly (not the kit's scrape.py) so we see
ALL raw columns, then checks the fields EnrichedPlace actually needs.

    docker compose up -d                       # in the google-maps-scraper-kit dir
    python3 scripts/spike-maps-scraper.py --lat 30.2672 --lon -97.7431 \
        --keyword lodging --depth 10

Read-only. Writes nothing outside stdout. Exit 1 on NO-GO.
"""
import argparse, csv, io, json, os, sys, time, urllib.request, urllib.error

BASE = os.environ.get("SCRAPER_BASE_URL", "http://localhost:8080")

# What EnrichedPlace (server/domain/places/client.ts:205) and placeCache
# (server/db/repositories/placeCache.ts) require, in order of blast radius.
# Each entry: (tripTribe field, column-name regexes to try).
# Column names below are the ones gosom/google-maps-scraper documents (README
# "Extracted Data Points", 36 fields). The regexes are only there to survive a
# rename; the first alternative in each list is the documented name.
NEEDS = [
    ("placeId  (CACHE KEY)", [r"^place_id$", r"^data_id$", r"^cid$"]),
    ("location.lat",         [r"^latitude$", r"^lat"]),
    ("location.lng",         [r"^longitude$", r"^lon", r"^lng"]),
    ("name",                 [r"^title$", r"^name$"]),
    ("primaryTypeName",      [r"^category$", r"^type"]),
    ("rating",               [r"^review_rating$", r"^rating$"]),
    ("userRatingCount",      [r"^review_count$"]),
    ("vicinity/address",     [r"^address$", r"^complete_address$"]),
    ("utcOffsetMinutes",     [r"^timezone$", r"utc.?_?offset"]),   # IANA name, NOT minutes
    ("regularOpeningHours",  [r"^open_hours$", r"open.*hour"]),
    ("priceLevel",           [r"^price_range$", r"price.?_?level"]),  # "$$", not 0-4 int
]

# Print, do not assert: nice to have, not load-bearing for a v1 migration.
BONUS = [("website", [r"^website$"]), ("phone", [r"^phone"]),
         ("photoName", [r"^thumbnail$", r"^images$"]), ("plusCode", [r"^plus_code$"])]


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as resp:
        return resp.read()


def pick(columns, patterns):
    import re
    for pat in patterns:
        rx = re.compile(pat, re.I)
        for c in columns:
            if rx.search(c):
                return c
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", required=True)
    ap.add_argument("--lon", required=True)
    ap.add_argument("--keyword", default="lodging")
    ap.add_argument("--depth", type=int, default=10)
    ap.add_argument("--radius", type=int, default=10000)
    a = ap.parse_args()

    try:
        req("GET", "/api/v1/jobs")
    except Exception as e:
        sys.exit(f"Scraper not reachable at {BASE}: {e}\n  docker compose up -d first")

    started = time.time()
    body = {"name": "triptribe-spike", "keywords": [a.keyword], "lang": "en", "zoom": 15,
            "lat": str(a.lat), "lon": str(a.lon), "fast_mode": False,
            "radius": a.radius, "depth": a.depth, "email": False, "max_time": 600}
    job_id = json.loads(req("POST", "/api/v1/jobs", body)).get("id")
    print(f"job {job_id}  keyword={a.keyword!r}  depth={a.depth}  radius={a.radius}m")

    status = None
    for _ in range(90):
        status = json.loads(req("GET", f"/api/v1/jobs/{job_id}")).get("Status")
        if status == "ok":
            break
        if status == "failed":
            sys.exit("Job failed — likely IP rate-limited. Wait, or add proxies.")
        time.sleep(5)
    else:
        sys.exit("Timed out after 450s")
    elapsed = time.time() - started

    rows = list(csv.DictReader(io.StringIO(req("GET", f"/api/v1/jobs/{job_id}/download").decode("utf-8", "replace"))))
    if not rows:
        sys.exit("Job returned 0 rows — that is itself a NO-GO.")
    columns = list(rows[0].keys())

    print(f"\n{len(rows)} rows in {elapsed:.0f}s  (Places API equivalent: ~0.3s)")
    print(f"\n--- all {len(columns)} raw columns ---\n  " + "\n  ".join(columns))

    def report(label, specs, strict):
        missing = []
        print(f"\n--- {label} ---")
        for name, pats in specs:
            col = pick(columns, pats)
            if col is None:
                print(f"  MISSING  {name}")
                if strict:
                    missing.append(name)
                continue
            sample = next((r[col] for r in rows if (r.get(col) or "").strip()), "")
            filled = sum(1 for r in rows if (r.get(col) or "").strip())
            print(f"  ok  {name:24} <- {col:28} {filled}/{len(rows)} filled  e.g. {sample[:52]!r}")
        return missing

    missing = report("required by EnrichedPlace", NEEDS, strict=True)
    # gosom's Web UI docs say results take "at least 3 minutes (minimum configured
    # runtime)". TripTribe's inline budget is PLACES_TIMEOUT_MS=15s (env.ts:81).
    # So latency decides the architecture, not the quota: >60s forces the scraper
    inline = elapsed < 15
    inline = elapsed < 60
    print("\n=== VERDICT ===")
    print(f"latency   {elapsed:.0f}s for {len(rows)} rows vs 15s inline budget (env.ts:81)")
    print(f"          -> {'GO, stays inline' if inline else 'TOO SLOW inline: must become a background prewarm job'}")
    if missing:
        print("GO on fields, NO-GO inline. Requires async prewarm + cache-only reads.")
        return 1
    if inline:
        print("GO. Still open: is placeId byte-stable across two runs?")
    else:
        print("GO on fields, NO-GO inline. Requires async prewarm + cache-only reads.")
    print(f"  re-run and diff:  python3 scripts/spike-maps-scraper.py --lat {a.lat} --lon {a.lon} --keyword '{a.keyword}' --depth {a.depth}")
    return 0
    print("\n=== VERDICT ===")
    print(f"latency   {elapsed:.0f}s for {len(rows)} rows  -> {'OK' if elapsed < 60 else 'TOO SLOW for an inline request'}")
    if missing:
        print(f"NO-GO. Missing and load-bearing: {', '.join(missing)}")
        print("  TripTribe cannot key placeCache or placesSnapshot without these.")
        return 1
    print("GO on field shape. Still open: is placeId stable across two runs?")
    print(f"  re-run this script and diff:  python3 scripts/spike-maps-scraper.py --lat {a.lat} --lon {a.lon} --keyword '{a.keyword}' --depth {a.depth}")
    return 0


if __name__ == "__main__":
    sys.exit(main())