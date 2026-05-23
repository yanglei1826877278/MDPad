import { useState, useRef, useEffect } from "react";
import "./DropdownMenu.css";

export default function DropdownMenu({ label, items, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <span
        className="dropdown-trigger"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen(!open)}
      >
        {label}
      </span>
      {open && (
        <div className="dropdown-list">
          {items.map((item, i) =>
            item === "---" ? (
              <div key={i} className="dropdown-sep" />
            ) : (
              <div
                key={i}
                className="dropdown-item"
                onClick={() => {
                  setOpen(false);
                  onAction(item.action);
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <span className="dropdown-shortcut">{item.shortcut}</span>}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
