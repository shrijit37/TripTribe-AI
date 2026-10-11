import type { NamedPlace } from "@/lib/types";

/**
 * `arriveAt`, `departAt` and `endMinute` are minutes past midnight, not
 * strings, and any of them may be missing. The measuring face wants a clock,
 * so this is the one place the number becomes a figure — and a figure the
 * payload did not send is shown as a blank, never as a guess.
 */
export const clock = (minutes?: number | null): string | null => {
    if (minutes == null || !Number.isFinite(minutes)) return null;
    const total = Math.round(minutes);
    if (total < 0 || total > 24 * 60) return null;
    const hours = Math.floor(total / 60) % 24;
    return `${String(hours).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * One stop on a day, ruled rather than boxed.
 *
 * This used to be a card — a filled panel with an emerald heading — which made
 * every stop shout at the same volume and cut a day into separate piles. A day
 * is a run of stops in sequence, so it is ruled as one: the hours the stop
 * occupies sit in the measuring face at the head of the rule, the place is the
 * line, and the description hangs beneath it.
 *
 * A meal is a stop as well, so it is ruled on the same grid as everything else
 * and takes its meal name as a reference mark on its own line rather than a
 * column of its own — one set of rules under one heading, not two ledgers.
 */
const ActivityCard = ({
    place,
    meal,
    anchor = false,
}: {
    place: NamedPlace;
    /** The meal this stop is seated in: "Breakfast", "Lunch", "Dinner". */
    meal?: string;
    /** The first move of the day, and the one the rest of the day hangs off. */
    anchor?: boolean;
}) => {
    const arrives = clock(place.arriveAt);
    const departs = clock(place.departAt);
    const span =
        arrives && departs ? `${arrives}–${departs}` : arrives ?? departs ?? null;
    const held = (place.waitMinutes ?? 0) > 0;

    const classes = ["tt-stop"];
    if (meal) classes.push("tt-stop--meal");
    if (anchor) classes.push("tt-stop--anchor");

    return (
        <li className={classes.join(" ")}>
            <span className="tt-stop__hour">{span ?? "—"}</span>
            <div className="tt-stop__main">
                <h4 className="tt-stop__place">{place.place}</h4>
                {place.description ? (
                    <p className="tt-stop__note">
                        {meal ? (
                            <span className="tt-stop__tag">{meal}</span>
                        ) : null}
                        {place.description}
                    </p>
                ) : null}
                {held || place.openedAfterWait ? (
                    <p className="tt-stop__flag">
                        {held ? `HELD ${place.waitMinutes} MIN` : null}
                        {held && place.openedAfterWait ? " · " : null}
                        {place.openedAfterWait ? "OPENS LATER" : null}
                    </p>
                ) : null}
            </div>
        </li>
    );
};

export default ActivityCard;