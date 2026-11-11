import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "./Media";
import { Badge } from "./ui";

export function RecordCard({ title, subtitle, assetId, icon: Icon, status, facts, href, action, children, cover, secondary }) {
  return <article className={"record-card" + (cover ? " record-card-with-cover" : "")}>
    {cover && <div className="record-card-cover">{cover}</div>}
    <header>
      {assetId ? <Avatar assetId={assetId} name="" size={46}/> : <span className="record-card-icon"><Icon size={21} aria-hidden="true"/></span>}
      {status && <Badge>{status}</Badge>}
    </header>
    <div className="record-card-identity">
      <h3>{href ? <a href={href}>{title}</a> : title}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
    <dl className="record-card-facts">
      {facts.map(({ label, value, icon: FactIcon }) => <div key={label}>
        <dt><FactIcon size={15} aria-hidden="true"/>{label}</dt>
        <dd>{value}</dd>
      </div>)}
    </dl>
    {children}
    {(href || secondary) && <footer>
      {href && <a href={href} aria-label={action + " · " + title}>{action}<ArrowUpRight size={16} aria-hidden="true"/></a>}
      {secondary}
    </footer>}
  </article>;
}
