import multer from "multer";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { route } from "../../core/http.js";
import { z, id } from "../../core/validation.js";
import { assert } from "../../core/db.js";
import * as S from "./media.service.js";
const storage = multer.diskStorage({
    destination(req, f, cb) {
      fs.mkdirSync(S.dir(), { recursive: true });
      cb(null, S.dir());
    },
    filename(req, f, cb) {
      cb(null, randomUUID());
    },
  }),
  upload = (req, res, next) => {
    try {
      assert(req.identity?.user, 401, "AUTH_REQUIRED", "Please sign in.");
      multer({
        storage,
        limits: { fileSize: 157286400, files: 1, fields: 3 },
      }).single("file")(req, res, next);
    } catch (e) {
      next(e);
    }
  };
export function routes(r) {
  route(
    r,
    "post",
    "/media/assets",
    z
      .object({
        purpose: z.enum([
          "AVATAR",
          "PORTFOLIO",
          "CONTENT",
          "EVIDENCE",
          "CAMPAIGN_COVER",
        ]),
        collaborationId: id.optional(),
      })
      .strict(),
    S.upload,
    { upload },
  );
  route(r, "get", "/media/assets/:assetId", null, (c, b, p) =>
    S.access(c, p.assetId),
  );
  route(r, "get", "/media/assets/:assetId/content", null, (c, b, p) =>
    S.bytes(c, p.assetId),
  );
  route(r, "delete", "/media/assets/:assetId", null, (c, b, p) =>
    S.retire(c, p.assetId),
  );
}
