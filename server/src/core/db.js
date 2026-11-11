import mongoose from "mongoose";
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}
export const assert = (c, s, code, m) => {
  if (!c) throw new AppError(s, code, m);
};
export const same = (a, b) => a && b && String(a) === String(b);
export const plain = (d) => (d?.toObject ? d.toObject() : d);
export async function get(Model, id, c = {}, filter = {}) {
  assert(
    id && mongoose.isValidObjectId(id),
    422,
    "INVALID_REFERENCE",
    "Choose a valid referenced record.",
  );
  const d = await Model.findOne({ _id: id, ...filter }).session(
    c.session || null,
  );
  assert(d, 404, "NOT_FOUND", "This record is unavailable.");
  return d;
}
export async function create(Model, b, c) {
  return (await Model.create([b], { session: c.session }))[0];
}
export const save = (d, c) => d.save({ session: c.session });
export function expected(d, b) {
  assert(
    Number.isSafeInteger(b.expectedVersion),
    422,
    "VERSION_REQUIRED",
    "Supply the record version.",
  );
  assert(
    d.__v === b.expectedVersion,
    409,
    "VERSION_CONFLICT",
    "This record changed. Refresh and retry.",
  );
}
export async function list(Model, filter, c, q = {}, projection = "") {
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  if (q.cursor)
    assert(
      mongoose.isValidObjectId(q.cursor),
      422,
      "CURSOR_INVALID",
      "Invalid page cursor.",
    );
  const f = q.cursor ? { $and: [filter, { _id: { $lt: q.cursor } }] } : filter;
  const rows = await Model.find(f)
    .select(projection)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .session(c.session || null);
  return {
    data: rows.slice(0, limit),
    page: {
      nextCursor: rows.length > limit ? String(rows[limit - 1]._id) : null,
      hasMore: rows.length > limit,
    },
  };
}
export const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function errors(e, req, res, next) {
  if (res.headersSent) return next(e);
  let status = e.status || 500,
    code = e.code || "INTERNAL_ERROR",
    message = e.status ? e.message : "Unable to complete this request.";
  if (
    ["ZodError", "ValidationError", "CastError", "StrictModeError"].includes(
      e.name,
    )
  ) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = e.issues?.[0]?.message || "Check the supplied fields.";
  }
  if (e.code === 11000 || e.name === "VersionError") {
    status = 409;
    code = "CONFLICT";
    message = "This record already exists or changed. Refresh and retry.";
  }
  if (e.name === "MulterError") {
    status = 422;
    code = e.code;
    message = "Upload rejected. Choose one supported file up to 150 MB.";
  }
  if (e.code === "ENOENT") {
    status = 404;
    code = "NOT_FOUND";
    message = "File unavailable.";
  }
  if (status === 500) console.error("Request failed", req.requestId, e.name);
  res.status(status).json({
    error: {
      code,
      message,
      fieldErrors: e.issues || [],
      requestId: req.requestId,
    },
  });
}
