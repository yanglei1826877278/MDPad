import { useRef, useEffect } from "react";
import "./DropdownMenu.css";

export default function DropdownMenu({
  label,
  items,
  onAction,
  isOpen,
  onToggle,
  onOpen,
  onClose,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <div className="dropdown" ref={ref}>
      <span
        className="dropdown-trigger"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => onToggle()}
        onMouseEnter={() => {
          if (isOpen) return;
          onOpen();
        }}
      >
        {label}
      </span>
      {isOpen && (
        <div className="dropdown-list">
          {items.map((item, i) =>
            item === "---" ? (
              <div key={i} className="dropdown-sep" />
            ) : (
              <div
                key={i}
                className="dropdown-item"
                onClick={() => {
                  onClose();
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
