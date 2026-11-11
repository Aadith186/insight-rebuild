import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export function SelectMenu({ id, label, value, options, onChange, required = false, placeholder = "Choose an option", icon: Icon }) {
  const menuId = useId();
  const trigger = useRef(null);
  const popup = useRef(null);
  const typeahead = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const selected = options.findIndex(option => String(option.value) === String(value ?? ""));

  function close() {
    setOpen(false);
    setPosition(null);
  }
  function show(index = Math.max(selected, 0)) {
    if (!options.length) return;
    setActive(index);
    setOpen(true);
  }
  function choose(index) {
    if (!options[index]) return;
    onChange(options[index].value);
    close();
  }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 10;
      const width = Math.min(Math.max(rect.width, 210), window.innerWidth - margin * 2);
      const below = window.innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      const flip = below < Math.min(options.length * 42 + 12, 254) && above > below;
      setPosition({
        width,
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
        maxHeight: Math.max(42, Math.min(280, (flip ? above : below) - 6)),
        ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      });
    };
    place();
    const followScroll = event => { if (!(event.target instanceof Node && popup.current?.contains(event.target))) place(); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", followScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", followScroll, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = event => {
      if (!trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open]);

  useEffect(() => {
    if (open && position) popup.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active, Boolean(position)]);

  function handleKeys(event) {
    const { key } = event;
    if (key === "Tab") { close(); return; }
    if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      if (!options.length) return;
      event.preventDefault();
      const next = key === "Home" ? 0 : key === "End" ? options.length - 1
        : open ? (active + (key === "ArrowDown" ? 1 : -1) + options.length) % options.length
          : selected >= 0 ? selected : key === "ArrowDown" ? 0 : options.length - 1;
      show(next);
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else show();
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - typeahead.current.time < 600 ? typeahead.current.text : "") + key.toLowerCase();
      typeahead.current = { text, time: now };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(text));
      if (index >= 0) show(index);
    }
  }

  return <div className="insight-select">
    <button id={id} ref={trigger} type="button" role="combobox"
      className="insight-select-trigger"
      aria-label={label} aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-activedescendant={open ? menuId + "-" + active : undefined}
      aria-required={required || undefined} disabled={!options.length}
      onClick={() => open ? close() : show()} onKeyDown={handleKeys} onBlur={close}>
      {Icon && <Icon size={16} aria-hidden="true"/>}
      <span>{options[selected]?.label ?? placeholder}</span>
      <ChevronDown size={16} className="select-chevron" aria-hidden="true"/>
    </button>
    {open && position && createPortal(
      <div className="insight-select-popup" id={menuId} role="listbox" aria-label={label} ref={popup} style={position}
        onMouseDown={event => event.preventDefault()}>
        {options.map((option, index) => <div key={option.value} id={menuId + "-" + index}
          role="option" aria-selected={index === selected} data-active={index === active}
          onPointerMove={event => { if (event.pointerType === "mouse") setActive(index); }} onClick={() => choose(index)}>
          <span>{option.label}</span>{index === selected && <Check size={16} aria-hidden="true"/>}
        </div>)}
      </div>,
      document.body,
    )}
  </div>;
}
