import { editorialImage } from "../app/platform";
import React from "react";
import { uid } from "../api/http";
export { mediaURL as assetURL } from "../api/http";
import { mediaURL as assetURL } from "../api/http";
export function Avatar({ assetId, name = "", size = 44, className = "" }) {
  return (
    <span
      className={"portrait-avatar " + className}
      style={{ width: size, height: size }}
    >
      {assetId ? (
        <img
          src={assetURL(assetId)}
          alt={name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          aria-label={name || "Profile image not added"}
          role="img"
        >
          <rect width="64" height="64" rx="32" fill="#dbe9ed" />
          <circle cx="32" cy="25" r="11" fill="#6d96a9" />
          <path d="M10 60c1-16 11-23 22-23s21 7 22 23" fill="#6d96a9" />
        </svg>
      )}
    </span>
  );
}
export function CampaignImage({
  assetId,
  niche = "",
  title = "",
  className = "",
}) {
  const fallback = /fashion|style/i.test(niche)
    ? "stones"
    : /food|coffee/i.test(niche)
      ? "studio"
      : /travel|life/i.test(niche)
        ? "wide"
        : "serum";
  return (
    <div className={"campaign-visual " + className}>
      <img
        src={assetURL(assetId) || editorialImage(fallback)}
        alt={assetId ? title : "Illustrative campaign artwork"}
        loading="lazy"
        onError={(e) => {
          if (!e.currentTarget.dataset.fallback) {
            e.currentTarget.dataset.fallback = "true";
            e.currentTarget.src = editorialImage(fallback);
          }
        }}
      />
      {!assetId && <small className="image-caption">Campaign artwork</small>}
    </div>
  );
}
export function Rating({ average = 0, count = 0 }) {
  return (
    <span className="rating-pill">
      <span aria-hidden="true">★</span>
      {count ? Number(average).toFixed(1) : "New"}
      {count > 0 && <small>({count})</small>}
    </span>
  );
}
