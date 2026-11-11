import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import * as M from "../../models.js";
import { get, create, save, same, assert } from "../../core/db.js";
import { collab, creator, chosen, campaign } from "../../core/policy.js";
export const dir = () => path.resolve(process.env.UPLOAD_DIR || "./uploads");
export async function access(c, id) {
  const a = await get(M.MediaAsset, id, c);
  assert(a.state === "READY", 404, "MEDIA_UNAVAILABLE", "Upload unavailable.");
  if (
    a.visibility === "PUBLIC" ||
    same(a.uploaderUserId, c.user._id) ||
    c.user.platformRole === "OWNER"
  )
    return a;
  if (a.purpose === "CAMPAIGN_COVER" && a.campaignId) {
    try {
      await campaign(c, a.campaignId);
      return a;
    } catch {}
    const revisions = await M.CampaignRevision.find({
      campaignId: a.campaignId,
      coverAssetId: a._id,
    })
      .distinct("_id")
      .session(c.session);
    const approval = await M.ClientApproval.findOne({
      targetType: "CAMPAIGN_REVISION",
      targetId: { $in: revisions },
      reviewerUserIds: c.user._id,
      state: { $in: ["PENDING", "APPROVED"] },
    }).session(c.session);
    if (approval) {
      await (
        await import("../approvals/approvals.service.js")
      ).access(c, approval._id);
      return a;
    }
  }
  assert(a.collaborationId, 404, "PRIVATE_MEDIA", "Private upload.");
  await collab(c, a.collaborationId, { reviewer: a.purpose !== "EVIDENCE" });
  return a;
}
export async function upload(c, b) {
  const f = c.req.file;
  assert(f, 422, "FILE_REQUIRED", "Choose a file.");
  try {
    if (b.purpose === "CAMPAIGN_COVER") {
      const { m } = chosen(c);
      assert(
        m.role !== "CLIENT_REVIEWER",
        403,
        "COMMISSIONER_REQUIRED",
        "Only commissioning teams can upload campaign covers.",
      );
    }
    if (b.collaborationId)
      await collab(c, b.collaborationId, { write: true, reviewer: false });
    if (b.purpose === "CONTENT") {
      creator(c);
      await collab(c, b.collaborationId, { write: true, creatorOnly: true });
    }
    if (["CONTENT", "EVIDENCE"].includes(b.purpose))
      assert(
        b.collaborationId,
        422,
        "WORK_REQUIRED",
        "Select a collaboration.",
      );
    const h = await fs.open(f.path, "r"),
      header = Buffer.alloc(32);
    await h.read(header, 0, 32, 0);
    await h.close();
    let mime;
    if (header.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
      mime = "image/jpeg";
    else if (
      header
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      mime = "image/png";
    else if (header.subarray(4, 8).toString() === "ftyp") mime = "video/mp4";
    else if (header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])))
      mime = "video/webm";
    assert(
      mime && mime === f.mimetype,
      422,
      "FILE_TYPE",
      "Use a valid JPEG, PNG, MP4 or WebM file.",
    );
    if (b.purpose === "CONTENT")
      assert(
        mime.startsWith("video/"),
        422,
        "VIDEO_REQUIRED",
        "Upload a video.",
      );
    if (["AVATAR", "CAMPAIGN_COVER"].includes(b.purpose))
      assert(
        mime.startsWith("image/") && f.size <= 10485760,
        422,
        "AVATAR_SIZE",
        "Use an image up to 10 MB.",
      );
    let durationMs, width, height;
    if (mime.startsWith("video/")) {
      let probe;
      try {
        probe = JSON.parse(
          (
            await promisify(execFile)(
              process.env.FFPROBE_PATH || "ffprobe",
              [
                "-v",
                "error",
                "-show_format",
                "-show_streams",
                "-of",
                "json",
                f.path,
              ],
              { timeout: 15000, maxBuffer: 1048576 },
            )
          ).stdout,
        );
      } catch {
        assert(
          false,
          422,
          "VIDEO_INVALID",
          "Cannot validate this video. Ensure ffprobe is installed.",
        );
      }
      const stream = probe.streams.find((s) => s.codec_type === "video");
      durationMs = Math.round(Number(probe.format.duration) * 1000);
      assert(
        stream && durationMs > 0 && durationMs <= 86400000,
        422,
        "VIDEO_DURATION",
        "Use a playable video shorter than 24 hours.",
      );
      width = stream.width;
      height = stream.height;
    }
    const checksum = await new Promise((resolve, reject) => {
      const h = createHash("sha256"),
        s = createReadStream(f.path);
      s.on("data", (d) => h.update(d));
      s.on("end", () => resolve(h.digest("hex")));
      s.on("error", reject);
    });
    return await create(
      M.MediaAsset,
      {
        uploaderUserId: c.user._id,
        purpose: b.purpose,
        collaborationId: b.collaborationId,
        storageKey: path.basename(f.path),
        originalName: f.originalname.slice(0, 250),
        mime,
        sizeBytes: f.size,
        checksum,
        durationMs,
        width,
        height,
        state: "READY",
      },
      c,
    );
  } catch (e) {
    await fs.unlink(f.path).catch(() => {});
    throw e;
  }
}
export async function bytes(c, id) {
  const a = await access(c, id),
    raw = await M.MediaAsset.findById(a._id).select("+storageKey"),
    file = path.join(dir(), path.basename(raw.storageKey)),
    stat = await fs.stat(file);
  let start = 0,
    end = stat.size - 1,
    status = 200;
  const range = c.req.get("Range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    assert(m && (m[1] || m[2]), 416, "INVALID_RANGE", "Invalid byte range.");
    start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2]));
    if (m[1] && m[2]) end = Math.min(end, Number(m[2]));
    assert(
      start <= end && start < stat.size,
      416,
      "INVALID_RANGE",
      "Invalid byte range.",
    );
    status = 206;
    c.res.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  }
  c.res.status(status).set({
    "Content-Type": a.mime,
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  });
  await new Promise((resolve, reject) => {
    const s = createReadStream(file, { start, end });
    s.on("error", reject);
    c.res.on("finish", resolve);
    c.res.on("close", resolve);
    s.pipe(c.res);
  });
}
export async function retire(c, id) {
  const a = await get(M.MediaAsset, id, c);
  assert(
    same(a.uploaderUserId, c.user._id),
    404,
    "NOT_FOUND",
    "Upload unavailable.",
  );
  const refs = await Promise.all([
    M.ContentVersion.exists({ assetId: id }),
    M.Campaign.exists({ "draft.coverAssetId": id }),
    M.CampaignRevision.exists({ coverAssetId: id }),
    M.PortfolioItem.exists({ assetId: id }),
    M.CreatorProfile.exists({ avatarAssetId: id }),
    M.Organization.exists({ logoAssetId: id }),
    M.ProductIssue.exists({ evidenceAssetIds: id }),
    M.Message.exists({ attachmentAssetIds: id }),
    M.Funding.exists({ proofAssetId: id }),
    M.Dispute.exists({ "evidence.resourceId": id }),
  ]);
  assert(
    !a.referenceCount && !refs.some(Boolean),
    409,
    "MEDIA_REFERENCED",
    "Referenced media is retained.",
  );
  a.state = "RETIRED";
  await save(a, c);
}
