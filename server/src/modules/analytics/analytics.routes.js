import { route } from "../../core/http.js";
import { overview } from "./analytics.service.js";
export function routes(r) {
  route(r, "get", "/analytics/overview", null, (c, b, p, q) => overview(c, q));
}
