import type { NamedPlace } from "@/lib/types";

export const clock = (minutes?: number | null): string | null => {
    if (minutes == null || !Number.isFinite(minutes)) return null;
    const total = Math.round(minutes);
    if (total < 0 || total > 24 * 60) return null;
    const hours = Math.floor(total / 60) % 24;
    return `${String(hours).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const ActivityCard = ({
    place,
    meal,
    anchor = false,
    index,
}: {
    place: NamedPlace;
    meal?: string;
    anchor?: boolean;
    index: number;
}) => {
    const arrives = clock(place.arriveAt);
    const departs = clock(place.departAt);
    const span =
        arrives && departs ? `${arrives}–${departs}` : arrives ?? departs ?? null;
    const held = (place.waitMinutes ?? 0) > 0;

    return (
        <li className="mx-rs-track">
            <span className="mx-rs-track__no" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
            </span>
            <div className="mx-rs-track__main">
                <h4 className="mx-rs-track__place">{place.place}</h4>
                {place.description ? (
                    <p className="mx-rs-track__note">
                        {meal ? (
                            <span className="mx-rs-tag">{meal}</span>
                        ) : null}
                        {anchor ? (
                            <span className="mx-rs-tag">First stop</span>
                        ) : null}
                        {place.description}
                    </p>
                ) : null}
                {held || place.openedAfterWait ? (
                    <p className="mx-rs-track__flag">
                        {held ? `HELD ${place.waitMinutes} MIN` : null}
                        {held && place.openedAfterWait ? " · " : null}
                        {place.openedAfterWait ? "OPENS LATER" : null}
                    </p>
                ) : null}
            </div>
            <span className="mx-rs-track__hour">{span ?? "—"}</span>
        </li>
    );
};

export default ActivityCard;
