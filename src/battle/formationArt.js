// WHERE THE RENDER ART IS SMALL ENOUGH TO USE.
//
// public/assets holds isometric renders of the formations, and they are good — but each one
// is around three megabytes, which is fine for a thing you look at and absurd for a thing
// that appears when a pointer crosses a marker. Hovering five formations would have pulled
// fourteen megabytes to draw five thumbnails.
//
// So `scripts/make-thumbs.mjs` writes a derivative of each one and this is the single place
// that says how wide and in what format. The script imports these constants rather than
// repeating them, so the card and the file on disk cannot end up describing different
// pictures.
//
// The board itself does not use any of this — it draws the silhouettes in formationGlyphs.js,
// because a render has no readable shape at marker size and nine formations share five files.
// This is the dossier, where there is room for the art and the duplication is survivable.
export const THUMB_WIDTH = 416;
export const THUMB_FORMAT = "webp";
export const THUMB_QUALITY = 82;

const ASSET_PREFIX = "/assets/";
const THUMB_PREFIX = "/assets/thumbs/";

// The mapping is TOTAL: an asset it does not recognise returns null and the caller draws no
// picture, rather than an <img> pointed at a path assembled out of whatever it was handed.
// FORMATIONS is authored in this repo and nothing user-supplied reaches here today, but a
// mapping that can only produce paths of one known shape stays safe if that changes.
export const thumbFor = (asset) => {
  if (typeof asset !== "string") return null;
  if (!asset.startsWith(ASSET_PREFIX) || !asset.endsWith(".png")) return null;
  const name = asset.slice(ASSET_PREFIX.length, -".png".length);
  // One flat directory, so a name is a name: no separators, no traversal, no empties.
  if (name.length === 0 || /[^a-zA-Z0-9._-]/.test(name) || name.includes("..")) return null;
  return `${THUMB_PREFIX}${name}.${THUMB_FORMAT}`;
};
