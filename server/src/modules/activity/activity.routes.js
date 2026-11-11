import { route } from "../../core/http.js";
import { z, date } from "../../core/validation.js";
import { sendCSV } from "../../core/csv.js";
import * as S from "./activity.service.js";
export function routes(r) {
  route(r, "get", "/notifications", null, (c, b, p, q) =>
    S.notifications(c, q),
  );
  route(r, "post", "/notifications/:notificationId/read", null, S.read);
  route(
    r,
    "post",
    "/notifications/read-all",
    z.object({ before: date.optional() }).strict(),
    S.readAll,
  );
  for (const kind of ["creator", "brand", "agency", "client-review"])
    route(r, "get", `/dashboards/${kind}`, null, (c) => S.dashboard(c, kind));
  for (const type of ["clients", "campaigns"]) {
    const param = type === "clients" ? "clientId" : "campaignId";
    route(r, "get", `/reports/${type}/:${param}`, null, (c, b, p, q) =>
      S.report(c, p, q),
    );
    route(
      r,
      "get",
      `/reports/${type}/:${param}/export`,
      null,
      async (c, b, p, q) =>
        sendCSV(c, "insight-report.csv", (await S.report(c, p, q)).rows),
    );
  }
  route(r, "get", "/audit-logs", null, (c, b, p, q) => S.audits(c, q));
}
