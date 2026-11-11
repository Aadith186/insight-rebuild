import { EventEmitter } from "node:events";
// Only transport-safe record IDs go through the bus; each recipient is authorized live.
export const realtimeBus = new EventEmitter();
export function committedEvent(path, method, result) {
  if (method === "post" && /^\/conversations\/[^/]+\/messages$/.test(path))
    realtimeBus.emit("conversation", {
      conversationId: String(result.conversationId),
      type: "message:new",
      message: result,
    });
  if (method === "post" && /^\/conversations\/[^/]+\/read$/.test(path))
    realtimeBus.emit("conversation", {
      conversationId: String(result._id || result.id),
      type: "conversation:read",
    });
}
