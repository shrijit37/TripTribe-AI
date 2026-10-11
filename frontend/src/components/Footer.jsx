const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="tt-footer">
      <div className="tt-rail">
        <div className="tt-footer__inner">
          <div className="tt-footer__mark">
            <span className="tt-nav__wordmark">TripTribe</span>
            <span className="tt-footer__ref" aria-hidden="true">
              TT/ROUTE
            </span>
          </div>

          <p className="tt-footer__note">
            Itineraries, hotel shortlists and prices are generated estimates. Check
            availability and fares with the operator before you book.
          </p>

          <a className="tt-footer__contact" href="mailto:shrijit@triptribe.info">
            shrijit@triptribe.info
          </a>

          {/* No licence claim here: the repo declares MIT in README, ISC in
              backend/package.json, and ships no LICENSE file. Unresolvable
              without the owner, so the page asserts nothing. */}
          <p className="tt-footer__legal">{year}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;