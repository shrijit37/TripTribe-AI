const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mx-colophon">
      <div className="mx-colophon__inner">
        <div className="mx-colophon__mark">
          <span className="mx-colophon__wordmark">TripTribe</span>
          <span className="mx-colophon__ref" aria-hidden="true">
            TT/ROUTE
          </span>
        </div>

        <p className="mx-colophon__note">
          Itineraries, hotel shortlists and prices are generated estimates.
          Check availability and fares with the operator before you book.
        </p>

        <a
          className="mx-colophon__contact"
          href="mailto:shrijit@triptribe.info"
        >
          shrijit@triptribe.info
        </a>

        {/* No licence claim here: the repo declares MIT in the README and
            ships no LICENSE file. Unresolvable without the owner, so the
            page asserts nothing. */}
        <p className="mx-colophon__legal">{year}</p>
      </div>
    </footer>
  );
};

export default Footer;
