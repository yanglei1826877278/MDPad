import { useState, useRef, useEffect } from "react";
import "./FindReplaceBar.css";

export default function FindReplaceBar({ visible, onFind, onReplace, onReplaceAll, onClose }) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const findRef = useRef(null);

  useEffect(() => {
    if (visible && findRef.current) {
      findRef.current.focus();
    }
  }, [visible]);

  if (!visible) return null;

  const handleFindKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onFind(findText);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="find-replace-bar">
      <div className="fr-field">
        <input
          ref={findRef}
          className="fr-input"
          placeholder="查找..."
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          onKeyDown={handleFindKeyDown}
        />
        <button className="fr-btn" onClick={() => onFind(findText)}>查找</button>
      </div>
      <div className="fr-field">
        <input
          className="fr-input"
          placeholder="替换..."
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <button className="fr-btn" onClick={() => onReplace(findText, replaceText)}>替换</button>
        <button className="fr-btn" onClick={() => onReplaceAll(findText, replaceText)}>全部替换</button>
      </div>
      <button className="fr-close" onClick={onClose}>×</button>
    </div>
  );
}
