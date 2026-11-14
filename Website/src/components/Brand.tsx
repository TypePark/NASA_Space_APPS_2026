import logo from "../assets/logo.svg";

/** The team logo and product name, used in the top bar and on the welcome page. */
export default function Brand() {
  return (
    <>
      <img className="brand-logo" src={logo} alt="" width="36" height="36" />
      <span className="brand-name">AquaCosmos</span>
    </>
  );
}
