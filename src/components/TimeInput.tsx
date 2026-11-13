import { useEffect, useState } from "react";

type Props = {
  secs: number;
  disabled?: boolean;
  onChange: (secs: number) => void;
};

/** Champ temps H/M/S séparés — simple et précis. */
export function TimeInput({ secs, disabled, onChange }: Props) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");

  useEffect(() => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    setHours(h > 0 ? String(h) : "");
    setMinutes(m > 0 || h > 0 ? String(m).padStart(2, "0") : "");
    setSeconds(String(s).padStart(2, "0"));
  }, [secs]);

  const update = (h: string, m: string, s: string) => {
    const hh = h === "" ? 0 : parseInt(h, 10) || 0;
    const mm = m === "" ? 0 : parseInt(m, 10) || 0;
    const ss = s === "" ? 0 : parseInt(s, 10) || 0;
    onChange(hh * 3600 + mm * 60 + ss);
  };

  const handleHours = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, "");
    setHours(cleaned);
    update(cleaned, minutes, seconds);
  };

  const handleMinutes = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, "");
    setMinutes(cleaned);
    update(hours, cleaned, seconds);
  };

  const handleSeconds = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, "");
    setSeconds(cleaned);
    update(hours, minutes, cleaned);
  };

  return (
    <div className="time-input-group">
      <input
        type="text"
        inputMode="numeric"
        className="field time-input-field mono"
        placeholder="H"
        value={hours}
        disabled={disabled}
        onChange={(e) => handleHours(e.target.value)}
      />
      <span className="time-input-sep">:</span>
      <input
        type="text"
        inputMode="numeric"
        className="field time-input-field mono"
        placeholder="MM"
        value={minutes}
        disabled={disabled}
        onChange={(e) => handleMinutes(e.target.value)}
      />
      <span className="time-input-sep">:</span>
      <input
        type="text"
        inputMode="numeric"
        className="field time-input-field mono"
        placeholder="SS"
        value={seconds}
        disabled={disabled}
        onChange={(e) => handleSeconds(e.target.value)}
      />
    </div>
  );
}
