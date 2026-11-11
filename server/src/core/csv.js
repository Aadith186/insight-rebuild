export function csv(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))],
    cell = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
  return [
    cols,
    ...rows.map((r) =>
      cols.map((k) => (typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k])),
    ),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
export function sendCSV(c, name, rows) {
  c.res.type("text/csv").attachment(name).send(csv(rows));
}
