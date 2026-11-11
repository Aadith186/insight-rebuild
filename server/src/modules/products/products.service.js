import * as M from "../../models.js";
import { get, create, save, expected, same, assert } from "../../core/db.js";
import { collab } from "../../core/policy.js";
import { event } from "../../core/events.js";
import { ownAsset } from "../creators/creators.service.js";
export async function address(c, b, p) {
  const d = await collab(c, p.collaborationId, {
    write: true,
    creatorOnly: true,
  });
  assert(
    ["ADDRESS_REQUIRED", "AWAITING_SHIPMENT"].includes(d.productState),
    409,
    "ADDRESS_LOCKED",
    "Address cannot change after dispatch.",
  );
  const pkg = await M.ProductPackage.findOne({
    collaborationId: d._id,
  }).session(c.session);
  assert(pkg, 409, "NO_PRODUCTS", "Agreement has no products.");
  pkg.deliveryAddress = b;
  pkg.addressSubmittedByUserId = c.user._id;
  await save(pkg, c);
  d.productState = "AWAITING_SHIPMENT";
  await save(d, c);
  await event(c, "DELIVERY_ADDRESS_ADDED", d);
  return pkg;
}
export async function ship(c, b, p) {
  const d = await collab(c, p.collaborationId, {
      write: true,
      commissioner: true,
    }),
    pkg = await M.ProductPackage.findOne({ collaborationId: d._id }).session(
      c.session,
    );
  assert(
    pkg?.deliveryAddress,
    409,
    "ADDRESS_REQUIRED",
    "Wait for a delivery address.",
  );
  if (b.replacementForShipmentId) {
    const old = await get(M.Shipment, b.replacementForShipmentId, c, {
        collaborationId: d._id,
      }),
      issue = await get(M.ProductIssue, b.productIssueId, c, {
        collaborationId: d._id,
      });
    assert(
      same(issue.shipmentId, old._id) && issue.state === "OPEN",
      422,
      "REPLACEMENT_INVALID",
      "Replacement must match an open issue.",
    );
    issue.state = "REPLACEMENT_SENT";
    await save(issue, c);
  } else
    assert(
      d.productState === "AWAITING_SHIPMENT" && !b.productIssueId,
      409,
      "SHIPMENT_EXISTS",
      "Use a replacement for an existing shipment.",
    );
  const s = await create(
    M.Shipment,
    {
      ...b,
      productPackageId: pkg._id,
      collaborationId: d._id,
      events: [{ kind: "DISPATCHED", actorUserId: c.user._id, at: new Date() }],
    },
    c,
  );
  d.productState = "SHIPPED";
  await save(d, c);
  await event(c, "PRODUCT_SHIPPED", d);
  return s;
}
export async function tracking(c, b, p) {
  const s = await get(M.Shipment, p.shipmentId, c);
  await collab(c, s.collaborationId, { write: true, commissioner: true });
  expected(s, b);
  assert(
    s.state !== "RECEIVED",
    409,
    "RECEIVED",
    "A received shipment cannot change.",
  );
  const { expectedVersion, ...v } = b;
  Object.assign(s, v);
  s.events.push({
    kind: "TRACKING_UPDATED",
    actorUserId: c.user._id,
    at: new Date(),
  });
  await save(s, c);
  return s;
}
export async function receipt(c, b, p) {
  const s = await get(M.Shipment, p.shipmentId, c),
    d = await collab(c, s.collaborationId, { write: true, creatorOnly: true });
  assert(
    ["DISPATCHED", "ISSUE"].includes(s.state) &&
      !s.receivedAt &&
      b.confirmation,
    409,
    "RECEIPT_STATE",
    "Confirm an unreceived shipment.",
  );
  s.state = "RECEIVED";
  s.receivedByUserId = c.user._id;
  s.receivedAt = new Date();
  s.events.push({
    kind: "RECEIVED",
    note: b.note,
    actorUserId: c.user._id,
    at: new Date(),
  });
  await save(s, c);
  const count = await M.ProductIssue.countDocuments({
    collaborationId: d._id,
    state: { $ne: "RESOLVED" },
  }).session(c.session);
  d.productState = count ? "ISSUE" : "RECEIVED";
  await save(d, c);
  await event(c, "PRODUCT_RECEIVED", d);
  return s;
}
export async function issue(c, b, p) {
  const s = await get(M.Shipment, p.shipmentId, c),
    d = await collab(c, s.collaborationId, { write: true, creatorOnly: true });
  assert(
    !["COMPLETED", "REFUNDED", "REFUND_PENDING"].includes(d.workState),
    409,
    "WORK_CLOSED",
    "Work is closed.",
  );
  for (const id of b.evidenceAssetIds) {
    const a = await ownAsset(c, id, "EVIDENCE");
    assert(
      same(a.collaborationId, d._id),
      422,
      "EVIDENCE_SCOPE",
      "Evidence belongs to other work.",
    );
  }
  const i = await create(
    M.ProductIssue,
    {
      ...b,
      collaborationId: d._id,
      shipmentId: s._id,
      reportedByUserId: c.user._id,
    },
    c,
  );
  s.state = "ISSUE";
  s.events.push({
    kind: "ISSUE",
    note: b.description,
    actorUserId: c.user._id,
    at: new Date(),
  });
  await save(s, c);
  d.productState = "ISSUE";
  await save(d, c);
  await event(c, "PRODUCT_ISSUE_REPORTED", d);
  return i;
}
export async function resolve(c, b, p) {
  const i = await get(M.ProductIssue, p.issueId, c),
    d = await collab(c, i.collaborationId, { write: true, commissioner: true });
  assert(
    i.state !== "RESOLVED",
    409,
    "ISSUE_CLOSED",
    "Issue already resolved.",
  );
  const s = await get(M.Shipment, b.receivedShipmentId, c, {
    collaborationId: d._id,
    state: "RECEIVED",
  });
  assert(
    s.receivedByUserId &&
      ((same(s.productIssueId, i._id) &&
        same(s.replacementForShipmentId, i.shipmentId)) ||
        same(s._id, i.shipmentId)),
    409,
    "RECEIPT_REQUIRED",
    "Matching creator-confirmed receipt required.",
  );
  i.state = "RESOLVED";
  i.resolutionNote = b.resolutionNote;
  await save(i, c);
  d.productState = (await M.ProductIssue.countDocuments({
    collaborationId: d._id,
    state: { $ne: "RESOLVED" },
  }).session(c.session))
    ? "ISSUE"
    : "RECEIVED";
  await save(d, c);
  await event(c, "PRODUCT_ISSUE_RESOLVED", d);
  return i;
}
export async function ask(c, b, p) {
  const d = await collab(c, p.collaborationId, {
    write: true,
    reviewer: false,
  });
  const q = await create(
    M.ProductQuestion,
    { ...b, collaborationId: d._id, askedByUserId: c.user._id },
    c,
  );
  await event(c, "PRODUCT_QUESTION", d);
  return q;
}
export async function answer(c, b, p) {
  const q = await get(M.ProductQuestion, p.questionId, c),
    d = await collab(c, q.collaborationId, { write: true, commissioner: true });
  q.answers.push({ text: b.text, authorUserId: c.user._id, at: new Date() });
  q.state = "ANSWERED";
  await save(q, c);
  await event(c, "PRODUCT_ANSWER", d);
  return q;
}
