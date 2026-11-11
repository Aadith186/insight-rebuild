export function presentRows(
  rows,
  { search = "", state = "", sort = "recent" } = {},
) {
  const needle = search.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (!state ||
        (r.workState || r.state || r.status || r.verificationStatus) ===
          state) &&
      (!needle || JSON.stringify(r).toLowerCase().includes(needle)),
  );
  const name = row => String(row.name || row.title || row.label || row.campaign?.title ||
    row.campaign?.titleNormalized || row.campaignTitle || row.creator?.userId?.name ||
    row.brand?.name || row.creatorName || row.brandName || "");
  const amount = row => row.amountMinor ?? row.grossMinor ?? row.proposedRateMinor ??
    row.campaign?.publicBudgetPerCreatorMinor ?? row.creator?.startingRateMinor ??
    row.revisions?.at(-1)?.amountMinor ?? row.budgetMinor ?? 0;
  return [...visible].sort((a, b) =>
    sort === "name"
      ? name(a).localeCompare(name(b))
      : sort === "oldest"
        ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        : sort === "amount"
          ? amount(b) - amount(a)
          : new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
}
export function chatTime(value, now = new Date()) {
  if (!value) return "";
  const d = new Date(value);
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return d.toDateString() === yesterday.toDateString()
    ? "Yesterday"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export function filterInbox(rows, mode = "all", search = "") {
  const needle = search.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (mode !== "unread" || r.unreadCount > 0) &&
      (mode !== "campaigns" || r.contextType === "CAMPAIGN") &&
      (mode !== "work" || r.contextType === "COLLABORATION") &&
      (!needle ||
        [r.title, r.campaignTitle, r.lastMessage?.text]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)),
  );
}


const workActions = {
  PREPARATION: "Submit content",
  REVISION_REQUESTED: "Submit revised cut",
  APPROVED: "Publish or hand over",
  IN_REVIEW: "Review submitted content",
  COMPLETION_REVIEW: "Check completion evidence",
  VERIFIED: "Review settlement",
};

export const workAction = state => workActions[state] || "Open collaboration";
