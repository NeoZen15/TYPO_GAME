// Marker that the player has seen the onboarding once. A cookie and not
// localStorage: /onboarding is a server page and reads it before rendering, so a
// returning player is sent to /game without the onboarding flashing first.
export const ONBOARDED_COOKIE = "jdt-onboarded";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const markOnboarded = () => {
  if (typeof document === "undefined") return;
  document.cookie = `${ONBOARDED_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
};
