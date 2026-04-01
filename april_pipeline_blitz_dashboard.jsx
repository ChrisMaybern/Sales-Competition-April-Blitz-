import { useState, useCallback, useMemo } from "react";

/* ─────────── CONSTANTS ─────────── */
const MEETING_TYPES = ["M1 - Initial Call", "M2 - Follow-Up", "M3 - Deep Dive", "M4 - Advanced"];
const STAGE_MAP = { "M1 - Initial Call": "m1", "M2 - Follow-Up": "m2", "M3 - Deep Dive": "m3", "M4 - Advanced": "m3" };
const STAGE_MULT = { m1: 1, m2: 1.5, m3: 2.25 };
const AE_MAX = 20;
const SDR_MAX = 25;

const DEFAULT_TEAMS = [
  { id: 1, members: ["Gabi", "Will"] },
  { id: 2, members: ["Brad", "Asaf"] },
  { id: 3, members: ["Chris K", "Bryan"] },
];
const DEFAULT_SDRS = ["Alex", "Steph"];
const TEAM_COLORS = ["#26EDCA", "#FF5C8D", "#F0C840"];
const SDR_COLORS = ["#26EDCA", "#FF5C8D"];

/* ─────────── HELPERS ─────────── */
function calcPts(meetings) {
  return meetings.reduce((sum, m) => sum + (STAGE_MULT[STAGE_MAP[m.type] || "m1"] || 1), 0);
}
function check6535(a, b) {
  const total = a + b;
  if (total === 0) return { ok: true, split: "0/0" };
  const pA = Math.round((a / total) * 100);
  return { ok: Math.max(pA, 100 - pA) <= 65, split: `${pA}/${100 - pA}` };
}
function calcSDRPayout(m) { return m < 8 ? 0 : Math.floor(m / 5) * 1000; }
function getBizDays() {
  const s = new Date(2026, 3, 1), now = new Date(), e = new Date(2026, 3, 30);
  const cur = now > e ? e : now < s ? s : now;
  let c = 0, d = new Date(s);
  while (d <= cur) { if (d.getDay() % 6 !== 0) c++; d.setDate(d.getDate() + 1); }
  return Math.max(0, c);
}

/* ─────────── THEME ─────────── */
const T = {
  bg: "#0B1F1A",
  card: "rgba(38,237,202,0.04)",
  cardBorder: "rgba(38,237,202,0.12)",
  cardHover: "rgba(38,237,202,0.07)",
  accent: "#26EDCA",
  accentDim: "#1AAF96",
  text: "#E2F5F0",
  textMid: "rgba(226,245,240,0.6)",
  textDim: "rgba(226,245,240,0.4)",
  textFaint: "rgba(226,245,240,0.2)",
  red: "#FF5C8D",
  yellow: "#F0C840",
  green: "#26EDCA",
  inputBg: "rgba(38,237,202,0.06)",
  inputBorder: "rgba(38,237,202,0.15)",
};

/* ─────────── UI PRIMITIVES ─────────── */
function Badge({ children, color = T.accent }) {
  return <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 99, background: `${color}18`, color, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, border: `1px solid ${color}33`, textTransform: "uppercase", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>{children}</span>;
}

function Input({ value, onChange, placeholder, type = "text", style: sx = {} }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%", transition: "border-color 0.2s", ...sx }}
    onFocus={e => e.target.style.borderColor = T.accent + "55"} onBlur={e => e.target.style.borderColor = T.inputBorder} />;
}

function Select({ value, onChange, options, placeholder }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{
    background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 6, padding: "8px 10px",
    color: value ? T.text : T.textDim, fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none",
    width: "100%", cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(38,237,202,0.5)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center"
  }}>
    <option value="" style={{ background: "#0d2922" }}>{placeholder}</option>
    {options.map(o => <option key={o} value={o} style={{ background: "#0d2922" }}>{o}</option>)}
  </select>;
}

function Btn({ children, onClick, color = T.accent, disabled, full, small }) {
  return <button onClick={onClick} disabled={disabled} style={{
    padding: small ? "5px 12px" : "9px 16px", borderRadius: 6,
    border: `1px solid ${disabled ? T.textFaint : color + "55"}`,
    background: disabled ? "rgba(255,255,255,0.02)" : `${color}15`,
    color: disabled ? T.textFaint : color, fontSize: small ? 11 : 12,
    fontWeight: 700, cursor: disabled ? "default" : "pointer",
    fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.5, transition: "all 0.2s",
    width: full ? "100%" : "auto"
  }}>{children}</button>;
}

/* ── RACE TRACK ── */
function RaceTrack({ lanes, maxValue, title, subtitle, gateAt }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "20px 0", overflow: "hidden" }}>
      <div style={{ padding: "0 20px 16px", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 12, color: T.textDim }}>{subtitle}</span>}
      </div>
      <div style={{ position: "relative", padding: "0 20px" }}>
        {/* Grid */}
        <div style={{ position: "absolute", top: 0, left: 130, right: 20, bottom: 30, display: "flex", justifyContent: "space-between", pointerEvents: "none", zIndex: 0 }}>
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ borderLeft: i === 0 ? `2px solid ${T.cardBorder}` : `1px dashed ${T.textFaint}`, height: "100%" }} />)}
        </div>
        {/* Gate */}
        {gateAt && (
          <div style={{ position: "absolute", left: `calc(130px + ${(gateAt / maxValue) * 100}% * 0.82)`, top: 0, bottom: 30, zIndex: 2, pointerEvents: "none" }}>
            <div style={{ width: 0, height: "100%", borderLeft: `2px dashed ${T.yellow}88` }} />
            <div style={{ position: "absolute", top: -18, left: -16, fontSize: 9, color: T.yellow, fontFamily: "'Space Mono'", fontWeight: 700, whiteSpace: "nowrap" }}>🏁 GATE ({gateAt})</div>
          </div>
        )}
        {lanes.map((lane, i) => {
          const pct = Math.min(100, maxValue > 0 ? (lane.value / maxValue) * 100 : 0);
          const lead = lanes.every(l => l.value <= lane.value) && lane.value > 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: i < lanes.length - 1 ? 8 : 0, position: "relative", zIndex: 1 }}>
              <div style={{ minWidth: 110, paddingRight: 10, textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: lane.color, fontFamily: "'Space Mono'" }}>{lane.label}</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{lane.names}</div>
              </div>
              <div style={{ flex: 1, height: 58, background: `${lane.color}08`, borderRadius: 10, position: "relative", overflow: "hidden", border: lead ? `1px solid ${lane.color}44` : `1px solid ${T.textFaint}` }}>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: `1.5px dashed ${T.textFaint}` }} />
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${lane.color}08, ${lane.color}1A)`, borderRight: pct > 0 ? `2px solid ${lane.color}77` : "none", transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
                <div style={{ position: "absolute", left: `calc(${pct}% - ${pct > 5 ? 20 : -4}px)`, top: "50%", transform: "translateY(-50%) scaleX(-1)", transition: "left 0.8s cubic-bezier(.4,0,.2,1)", zIndex: 3, fontSize: 22, filter: `drop-shadow(0 0 8px ${lane.color}88)` }}>🏎️</div>
                <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6, zIndex: 4 }}>
                  {lane.extra && <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'Space Mono'" }}>{lane.extra}</span>}
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Mono'", color: lane.color, textShadow: `0 0 12px ${lane.color}44` }}>{lane.displayValue}</span>
                  {lane.unit && <span style={{ fontSize: 10, color: T.textDim, fontWeight: 600, textTransform: "uppercase" }}>{lane.unit}</span>}
                </div>
                {lead && lane.value > 0 && <div style={{ position: "absolute", left: 8, top: 6, background: `${lane.color}22`, border: `1px solid ${lane.color}44`, borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700, color: lane.color, fontFamily: "'Space Mono'" }}>P1</div>}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingLeft: 110 }}>
          {Array.from({ length: 6 }, (_, i) => <span key={i} style={{ fontSize: 9, color: T.textFaint, fontFamily: "'Space Mono'" }}>{Math.round((i / 5) * maxValue)}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ── MEETING FORM ── */
function MeetingForm({ onAdd, color, label }) {
  const [f, setF] = useState({ type: "", customer: "", contact: "", bookDate: "", meetDate: "" });
  const ok = f.type && f.customer && f.contact && f.bookDate && f.meetDate;
  const add = () => { if (ok) { onAdd({ ...f, id: Date.now() + Math.random() }); setF({ type: "", customer: "", contact: "", bookDate: "", meetDate: "" }); } };
  return (
    <div style={{ background: `${color}06`, border: `1px solid ${color}18`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>+ Log Meeting — {label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Select value={f.type} onChange={v => setF(p => ({ ...p, type: v }))} options={MEETING_TYPES} placeholder="Meeting Type" />
        <Input value={f.customer} onChange={v => setF(p => ({ ...p, customer: v }))} placeholder="Customer / Firm Name" />
        <Input value={f.contact} onChange={v => setF(p => ({ ...p, contact: v }))} placeholder="Contact Title (CFO, Controller…)" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Input type="date" value={f.bookDate} onChange={v => setF(p => ({ ...p, bookDate: v }))} placeholder="Booking Date" />
          <Input type="date" value={f.meetDate} onChange={v => setF(p => ({ ...p, meetDate: v }))} placeholder="Scheduled Date" />
        </div>
      </div>
      <div style={{ marginTop: 10 }}><Btn onClick={add} disabled={!ok} color={color} full>ADD MEETING</Btn></div>
    </div>
  );
}

/* ── MEETING TABLE ── */
function MeetingTable({ meetings, onRemove, color, compact }) {
  if (!meetings.length) return <div style={{ textAlign: "center", padding: 14, color: T.textFaint, fontSize: 12, fontStyle: "italic" }}>No meetings logged yet</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>
          {["#", "Type", "Customer", "Contact", "Booked", "Scheduled", ""].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "8px", fontSize: 9, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${T.cardBorder}`, whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{meetings.map((m, i) => {
          const sc = STAGE_MAP[m.type] || "m1";
          const sColor = sc === "m1" ? T.green : sc === "m2" ? T.yellow : T.red;
          return (
            <tr key={m.id} style={{ borderBottom: `1px solid ${T.textFaint}` }}>
              <td style={{ padding: 8, color: T.textDim, fontFamily: "'Space Mono'", fontSize: 11 }}>{i + 1}</td>
              <td style={{ padding: 8 }}><Badge color={sColor}>{m.type.split(" - ")[0]}</Badge></td>
              <td style={{ padding: 8, color: T.text, fontWeight: 600 }}>{m.customer}</td>
              <td style={{ padding: 8, color: T.textMid }}>{m.contact}</td>
              <td style={{ padding: 8, color: T.textDim, fontFamily: "'Space Mono'", fontSize: 11 }}>{m.bookDate}</td>
              <td style={{ padding: 8, color: T.textDim, fontFamily: "'Space Mono'", fontSize: 11 }}>{m.meetDate}</td>
              <td style={{ padding: 8 }}><button onClick={() => onRemove(m.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>×</button></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/* ═══════════════════ MAIN ═══════════════════ */
export default function Dashboard() {
  const [tab, setTab] = useState("race");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminPwError, setAdminPwError] = useState(false);
  const ADMIN_PW = "Chris April Blitz 2026";

  // Editable names
  const [teams, setTeams] = useState(DEFAULT_TEAMS.map(t => ({ ...t, members: [...t.members] })));
  const [sdrNames, setSdrNames] = useState([...DEFAULT_SDRS]);

  // All meetings keyed by slot: "ae-0-0" = team 0 member 0, "sdr-0" = sdr 0
  const [meetings, setMeetings] = useState({});
  const getMeetings = (key) => meetings[key] || [];
  const addMeeting = useCallback((key, m) => setMeetings(prev => ({ ...prev, [key]: [...(prev[key] || []), m] })), []);
  const removeMeeting = useCallback((key, id) => setMeetings(prev => ({ ...prev, [key]: (prev[key] || []).filter(x => x.id !== id) })), []);
  const updateMeeting = useCallback((key, id, field, value) => {
    setMeetings(prev => ({
      ...prev,
      [key]: (prev[key] || []).map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  }, []);

  // Name editing
  const [editingNames, setEditingNames] = useState(false);

  const daysPassed = getBizDays();
  const daysLeft = Math.max(0, 22 - daysPassed);
  const progress = Math.min(100, (daysPassed / 22) * 100);

  // Computed data
  const aeData = useMemo(() => teams.map((team, ti) => {
    const mA = getMeetings(`ae-${ti}-0`), mB = getMeetings(`ae-${ti}-1`);
    const ptsA = calcPts(mA), ptsB = calcPts(mB);
    return { team, mA, mB, ptsA, ptsB, totalPts: ptsA + ptsB, totalMtgs: mA.length + mB.length, bal: check6535(mA.length, mB.length), color: TEAM_COLORS[ti] };
  }), [teams, meetings]);

  const sdrData = useMemo(() => sdrNames.map((name, i) => {
    const m = getMeetings(`sdr-${i}`);
    return { name, meetings: m, count: m.length, payout: calcSDRPayout(m.length), color: SDR_COLORS[i] || T.accent };
  }), [sdrNames, meetings]);

  const aeLanes = [...aeData].map((d, i) => ({
    label: `Team ${d.team.id}`, names: d.team.members.join(" + "), value: d.totalPts,
    displayValue: d.totalPts % 1 === 0 ? d.totalPts.toFixed(0) : d.totalPts.toFixed(1),
    color: d.color, unit: "pts", extra: `${d.totalMtgs} mtgs`,
  })).sort((a, b) => b.value - a.value);

  const sdrLanes = [...sdrData].map(d => ({
    label: d.name, names: "", value: d.count, displayValue: d.count,
    color: d.color, unit: "mtgs", extra: d.count >= 8 ? `$${d.payout.toLocaleString()}` : `${8 - d.count} to gate`,
  })).sort((a, b) => b.value - a.value);

  const maxAE = Math.max(AE_MAX, ...aeLanes.map(l => l.value));
  const maxSDR = Math.max(SDR_MAX, ...sdrLanes.map(l => l.value));

  const allTabs = [
    { id: "race", label: "🏁 Race" },
    { id: "ae", label: "AE Teams" },
    { id: "sdr", label: "SDRs" },
    { id: "admin", label: "⚙️ Admin" },
    { id: "rules", label: "Rules" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <div style={{ position: "fixed", top: -300, right: -200, width: 700, height: 700, background: `radial-gradient(circle, ${T.accent}0A 0%, transparent 65%)`, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -200, left: -200, width: 600, height: 600, background: `radial-gradient(circle, ${T.accent}06 0%, transparent 65%)`, pointerEvents: "none" }} />

      {/* ─── HEADER ─── */}
      <div style={{ borderBottom: `1px solid ${T.cardBorder}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100, background: T.bg + "dd" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 13, letterSpacing: 2.5, color: T.accent }}>MAYBERN</div>
          <div style={{ width: 1, height: 16, background: T.cardBorder }} />
          <span style={{ fontSize: 12, color: T.textDim, fontWeight: 500 }}>April Pipeline Blitz 2026</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="pd" style={{ width: 7, height: 7, borderRadius: 99, background: daysLeft > 0 ? T.accent : T.red, boxShadow: `0 0 8px ${daysLeft > 0 ? T.accent : T.red}` }} />
          <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'Space Mono'" }}>{daysLeft > 0 ? `${daysLeft}d LEFT` : "CLOSED"}</span>
        </div>
      </div>

      {/* ─── STAT STRIP ─── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.cardBorder}`, overflowX: "auto" }}>
        {[
          { label: "Day", value: `${daysPassed}/22`, color: T.accent },
          { label: "Left", value: daysLeft, color: daysLeft <= 5 ? T.red : T.yellow },
          { label: "AE Prize", value: "$6K", color: T.red },
          { label: "SDR Cap", value: "∞", color: T.accent },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 80, padding: "12px 16px", textAlign: "center", borderRight: i < 3 ? `1px solid ${T.textFaint}` : "none" }}>
            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "'Space Mono'" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ─── PROGRESS ─── */}
      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: T.textFaint, fontFamily: "'Space Mono'" }}>APR 1</span>
          <span style={{ fontSize: 10, color: T.accent, fontFamily: "'Space Mono'" }}>{Math.round(progress)}%</span>
          <span style={{ fontSize: 10, color: T.textFaint, fontFamily: "'Space Mono'" }}>APR 30</span>
        </div>
        <div style={{ width: "100%", background: T.inputBg, borderRadius: 3, height: 5, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${T.accentDim}, ${T.accent})`, boxShadow: `0 0 10px ${T.accent}44`, transition: "width 0.8s" }} />
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.cardBorder}`, overflowX: "auto" }}>
        {allTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 18px", background: "none", border: "none",
            color: tab === t.id ? T.accent : T.textDim, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans'",
            borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
            transition: "all 0.2s", whiteSpace: "nowrap"
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>

        {/* ═══ RACE ═══ */}
        {tab === "race" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <RaceTrack title="🏆 AE Team Race" subtitle="Points (M1×1 · M2×1.5 · M3×2.25)" lanes={aeLanes} maxValue={maxAE} gateAt={8} />
            <RaceTrack title="🏆 SDR Race" subtitle="Qualified M1 Meetings" lanes={sdrLanes} maxValue={maxSDR} gateAt={8} />
            <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", padding: "12px 16px", background: T.card, borderRadius: 10, border: `1px solid ${T.cardBorder}` }}>
              {aeData.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                  <span style={{ fontSize: 11, color: T.textMid }}>{d.team.members.join(" + ")}</span>
                </div>
              ))}
              <div style={{ width: 1, height: 14, background: T.cardBorder }} />
              {sdrData.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                  <span style={{ fontSize: 11, color: T.textMid }}>{d.name}</span>
                </div>
              ))}
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: "12px 16px", textAlign: "center", fontSize: 12, color: T.textDim }}>
              Log meetings in <strong style={{ color: T.accent, cursor: "pointer" }} onClick={() => setTab("ae")}>AE Teams</strong> and <strong style={{ color: T.accent, cursor: "pointer" }} onClick={() => setTab("sdr")}>SDRs</strong> tabs · Edit names & data in <strong style={{ color: T.accent, cursor: "pointer" }} onClick={() => setTab("admin")}>Admin</strong>
            </div>
          </div>
        )}

        {/* ═══ AE TEAMS ═══ */}
        {tab === "ae" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>AE Team Scoring</span>
              <Badge color={T.red}>Competition B · $6K Prize</Badge>
            </div>
            {aeData.map((d, ti) => {
              const rank = [...aeData].sort((a, b) => b.totalPts - a.totalPts).findIndex(x => x.team.id === d.team.id) + 1;
              const maxPts = Math.max(...aeData.map(x => x.totalPts), 0.01);
              return (
                <div key={ti} style={{ background: T.card, border: `1px solid ${d.color}25`, borderRadius: 14, padding: 20, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 8, right: 16, fontSize: 52, fontWeight: 700, color: `${d.color}0A`, fontFamily: "'Space Mono'", pointerEvents: "none" }}>#{rank}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: d.color }}>Team {d.team.id}</span>
                        <span style={{ fontSize: 13, color: T.textMid }}>{d.team.members.join(" + ")}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {d.totalMtgs > 0 && <Badge color={d.bal.ok ? T.green : T.red}>{d.bal.ok ? `✓ ${d.bal.split}` : `✕ DQ — ${d.bal.split}`}</Badge>}
                        {d.totalMtgs > 0 && d.totalMtgs < 8 && <Badge color={T.yellow}>{8 - d.totalMtgs} TO MIN (8)</Badge>}
                        {d.totalMtgs >= 8 && d.bal.ok && <Badge color={T.green}>✓ QUALIFIED</Badge>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Space Mono'", color: d.color, lineHeight: 1 }}>{d.totalPts % 1 === 0 ? d.totalPts : d.totalPts.toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 4, letterSpacing: 1, textTransform: "uppercase" }}>points · {d.totalMtgs} meetings</div>
                    </div>
                  </div>
                  <div style={{ width: "100%", background: T.inputBg, borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 20 }}>
                    <div style={{ width: `${Math.min(100, (d.totalPts / maxPts) * 100)}%`, height: "100%", background: d.color, borderRadius: 4, boxShadow: `0 0 10px ${d.color}44`, transition: "width 0.7s" }} />
                  </div>
                  {d.team.members.map((member, mi) => {
                    const key = `ae-${ti}-${mi}`;
                    const mList = getMeetings(key);
                    const mPts = calcPts(mList);
                    return (
                      <div key={mi} style={{ background: `${d.color}06`, borderRadius: 12, padding: 16, border: `1px solid ${d.color}12`, marginBottom: mi === 0 ? 12 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: d.color }}>{member}</span>
                            <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'Space Mono'" }}>{mList.length} mtgs · {mPts % 1 === 0 ? mPts : mPts.toFixed(2)} pts</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {[{ l: "M1", s: "m1", c: T.green }, { l: "M2", s: "m2", c: T.yellow }, { l: "M3+", s: "m3", c: T.red }].map(x => (
                              <span key={x.l} style={{ fontSize: 10, fontFamily: "'Space Mono'", color: mList.filter(m => STAGE_MAP[m.type] === x.s).length > 0 ? x.c : T.textFaint }}>{x.l}:{mList.filter(m => STAGE_MAP[m.type] === x.s).length}</span>
                            ))}
                          </div>
                        </div>
                        <MeetingTable meetings={mList} onRemove={(id) => removeMeeting(key, id)} color={d.color} />
                        <div style={{ marginTop: 10 }}><MeetingForm onAdd={(m) => addMeeting(key, m)} color={d.color} label={member} /></div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ SDR ═══ */}
        {tab === "sdr" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>SDR Individual Scoring</span>
              <Badge color={T.accent}>Competition A · Uncapped</Badge>
            </div>
            {sdrData.map((d, si) => {
              const key = `sdr-${si}`;
              const gateHit = d.count >= 8;
              const nextTier = Math.ceil((d.count + 1) / 5) * 5;
              return (
                <div key={si} style={{ background: T.card, border: `1px solid ${d.color}25`, borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: d.color }}>{d.name}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <Badge color={gateHit ? T.green : T.red}>{gateHit ? "✓ GATE CLEARED" : `${8 - d.count} TO ACTIVATE`}</Badge>
                        {d.count > 0 && d.count % 5 !== 0 && gateHit && <Badge color={T.yellow}>{nextTier - d.count} TO NEXT $1K</Badge>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Space Mono'", color: gateHit ? T.green : T.red }}>${d.payout.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>payout · {d.count} meetings</div>
                    </div>
                  </div>
                  {/* Gate blocks */}
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
                    {Array.from({ length: Math.max(25, d.count + 2) }, (_, i) => {
                      const filled = i < d.count;
                      const isGate = i === 7;
                      let bg = `${T.accent}08`;
                      if (filled && !gateHit) bg = `${T.red}44`;
                      else if (filled && i < 8) bg = `${T.yellow}55`;
                      else if (filled) bg = `${T.green}55`;
                      return (
                        <div key={i} style={{ width: 26, height: 26, borderRadius: 5, background: bg, border: isGate ? `1.5px solid ${T.yellow}` : `1px solid ${T.textFaint}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: filled ? T.textMid : T.textFaint, fontFamily: "'Space Mono'", fontWeight: 600, position: "relative" }}>
                          {i + 1}
                          {isGate && <div style={{ position: "absolute", top: -14, fontSize: 8, color: T.yellow, fontWeight: 700, whiteSpace: "nowrap" }}>GATE</div>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Payout tiers */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                    {[{ r: "1–7", p: "$0", mn: 1, mx: 7 }, { r: "8–9", p: "$1K", mn: 8, mx: 9 }, { r: "10–14", p: "$2K", mn: 10, mx: 14 }, { r: "15–19", p: "$3K", mn: 15, mx: 19 }, { r: "20–24", p: "$4K", mn: 20, mx: 24 }, { r: "25+", p: "$5K+", mn: 25, mx: 999 }].map((t, i) => {
                      const cur = d.count >= t.mn && d.count <= t.mx;
                      return <div key={i} style={{ flex: "1 1 65px", minWidth: 65, padding: "8px 6px", textAlign: "center", background: cur ? `${d.color}1A` : T.card, border: cur ? `1.5px solid ${d.color}55` : `1px solid ${T.cardBorder}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: T.textDim, fontFamily: "'Space Mono'" }}>{t.r}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Mono'", color: i === 0 ? T.red : cur ? d.color : T.green }}>{t.p}</div>
                      </div>;
                    })}
                  </div>
                  <MeetingTable meetings={d.meetings} onRemove={(id) => removeMeeting(key, id)} color={d.color} />
                  <div style={{ marginTop: 12 }}><MeetingForm onAdd={(m) => addMeeting(key, m)} color={d.color} label={d.name} /></div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ ADMIN ═══ */}
        {tab === "admin" && !adminUnlocked && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: `${T.accent}12`, border: `1px solid ${T.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🔒</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>Admin Access</div>
            <div style={{ fontSize: 13, color: T.textDim, textAlign: "center", maxWidth: 320 }}>Enter the admin password to edit team names, meetings, and all backend data.</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", maxWidth: 360 }} onKeyDown={e => { if (e.key === "Enter") { if (adminPw === ADMIN_PW) { setAdminUnlocked(true); setAdminPwError(false); } else { setAdminPwError(true); } } }}>
              <Input
                type="password"
                value={adminPw}
                onChange={v => { setAdminPw(v); setAdminPwError(false); }}
                placeholder="Enter admin password"
                style={{ flex: 1, padding: "12px 14px", fontSize: 14, borderColor: adminPwError ? T.red : T.inputBorder }}
              />
              <Btn color={T.accent} onClick={() => {
                if (adminPw === ADMIN_PW) {
                  setAdminUnlocked(true);
                  setAdminPwError(false);
                } else {
                  setAdminPwError(true);
                }
              }}>UNLOCK</Btn>
            </div>
            {adminPwError && <div style={{ fontSize: 12, color: T.red, fontWeight: 600 }}>Incorrect password. Try again.</div>}
          </div>
        )}

        {tab === "admin" && adminUnlocked && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>⚙️ Admin Panel</span>
                <Badge color={T.yellow}>Edit Names & Meetings</Badge>
              </div>
              <Btn color={T.red} small onClick={() => { setAdminUnlocked(false); setAdminPw(""); }}>🔒 LOCK</Btn>
            </div>

            {/* ── NAME EDITOR ── */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginBottom: 16 }}>Team & SDR Names</div>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 14 }}>Edit names below — changes reflect everywhere instantly.</div>

              {teams.map((team, ti) => (
                <div key={ti} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: TEAM_COLORS[ti], marginBottom: 8 }}>AE Team {team.id}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {team.members.map((name, mi) => (
                      <div key={mi}>
                        <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Member {mi + 1}</div>
                        <Input value={name} onChange={v => setTeams(prev => {
                          const next = prev.map(t => ({ ...t, members: [...t.members] }));
                          next[ti].members[mi] = v;
                          return next;
                        })} placeholder={`AE Name ${mi + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ borderTop: `1px solid ${T.cardBorder}`, marginTop: 8, paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 8 }}>SDR Names</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {sdrNames.map((name, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>SDR {i + 1}</div>
                      <Input value={name} onChange={v => setSdrNames(prev => { const n = [...prev]; n[i] = v; return n; })} placeholder={`SDR Name ${i + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── MEETING EDITOR ── */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginBottom: 16 }}>All Meetings — Edit / Delete</div>

              {/* AE meetings */}
              {teams.map((team, ti) => team.members.map((member, mi) => {
                const key = `ae-${ti}-${mi}`;
                const mList = getMeetings(key);
                if (!mList.length) return null;
                return (
                  <div key={key} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Badge color={TEAM_COLORS[ti]}>Team {team.id}</Badge>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEAM_COLORS[ti] }}>{member}</span>
                      <span style={{ fontSize: 11, color: T.textDim }}>· {mList.length} meetings</span>
                    </div>
                    {mList.map((m, idx) => {
                      const sc = STAGE_MAP[m.type] || "m1";
                      const sColor = sc === "m1" ? T.green : sc === "m2" ? T.yellow : T.red;
                      return (
                        <div key={m.id} style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 1fr 1fr 1fr auto", gap: 6, alignItems: "center", marginBottom: 6, padding: "6px 0", borderBottom: `1px solid ${T.textFaint}` }}>
                          <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'Space Mono'", textAlign: "center" }}>{idx + 1}</span>
                          <Select value={m.type} onChange={v => updateMeeting(key, m.id, "type", v)} options={MEETING_TYPES} placeholder="Type" />
                          <Input value={m.customer} onChange={v => updateMeeting(key, m.id, "customer", v)} placeholder="Customer" />
                          <Input value={m.contact} onChange={v => updateMeeting(key, m.id, "contact", v)} placeholder="Contact Title" />
                          <Input type="date" value={m.bookDate} onChange={v => updateMeeting(key, m.id, "bookDate", v)} />
                          <Input type="date" value={m.meetDate} onChange={v => updateMeeting(key, m.id, "meetDate", v)} />
                          <button onClick={() => removeMeeting(key, m.id)} style={{ background: `${T.red}15`, border: `1px solid ${T.red}33`, borderRadius: 6, color: T.red, fontSize: 11, fontWeight: 700, padding: "6px 10px", cursor: "pointer" }}>DEL</button>
                        </div>
                      );
                    })}
                  </div>
                );
              }))}

              {/* SDR meetings */}
              {sdrNames.map((name, si) => {
                const key = `sdr-${si}`;
                const mList = getMeetings(key);
                if (!mList.length) return null;
                return (
                  <div key={key} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Badge color={SDR_COLORS[si]}>SDR</Badge>
                      <span style={{ fontSize: 13, fontWeight: 700, color: SDR_COLORS[si] }}>{name}</span>
                      <span style={{ fontSize: 11, color: T.textDim }}>· {mList.length} meetings</span>
                    </div>
                    {mList.map((m, idx) => (
                      <div key={m.id} style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 1fr 1fr 1fr auto", gap: 6, alignItems: "center", marginBottom: 6, padding: "6px 0", borderBottom: `1px solid ${T.textFaint}` }}>
                        <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'Space Mono'", textAlign: "center" }}>{idx + 1}</span>
                        <Select value={m.type} onChange={v => updateMeeting(key, m.id, "type", v)} options={MEETING_TYPES} placeholder="Type" />
                        <Input value={m.customer} onChange={v => updateMeeting(key, m.id, "customer", v)} placeholder="Customer" />
                        <Input value={m.contact} onChange={v => updateMeeting(key, m.id, "contact", v)} placeholder="Contact Title" />
                        <Input type="date" value={m.bookDate} onChange={v => updateMeeting(key, m.id, "bookDate", v)} />
                        <Input type="date" value={m.meetDate} onChange={v => updateMeeting(key, m.id, "meetDate", v)} />
                        <button onClick={() => removeMeeting(key, m.id)} style={{ background: `${T.red}15`, border: `1px solid ${T.red}33`, borderRadius: 6, color: T.red, fontSize: 11, fontWeight: 700, padding: "6px 10px", cursor: "pointer" }}>DEL</button>
                      </div>
                    ))}
                  </div>
                );
              })}

              {Object.values(meetings).every(arr => !arr.length) && (
                <div style={{ textAlign: "center", padding: 30, color: T.textFaint, fontSize: 13, fontStyle: "italic" }}>
                  No meetings logged yet. Add meetings in the AE Teams or SDR tabs.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ RULES ═══ */}
        {tab === "rules" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>ICP Qualification</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {[{ l: "Private Equity GP", i: "🏛️" }, { l: "Closed-End Funds", i: "📋" }, { l: "U.S.-Domiciled", i: "🇺🇸" }, { l: "$1B+ AUM (Firm Level)", i: "💰" }].map((c, i) => (
                  <div key={i} style={{ background: `${T.green}0A`, border: `1px solid ${T.green}25`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{c.i}</span><span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>{c.l}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 8, fontStyle: "italic" }}>All 4 must be met. When in doubt — ask Christopher before you book.</div>
            </div>
            <div style={{ background: `${T.red}0A`, border: `1px solid ${T.red}20`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 8 }}>✕ Does Not Qualify</div>
              <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.8 }}>Venture capital (any AUM) · Open-end / evergreen funds · Hedge funds · Non-U.S. firms · Fund administrators · Below $1B AUM · Family offices (unless PE GP w/ closed-end)</div>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Qualified Personas</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: `${T.green}0A`, border: `1px solid ${T.green}20`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 8 }}>✓ 1 Point Each</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.8 }}>Controller / Fund Controller · VP Finance · CFO / Head of Finance · COO / Head of Operations · Any role owning fund calc or waterfall governance</div>
                </div>
                <div style={{ background: `${T.red}0A`, border: `1px solid ${T.red}20`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 8 }}>✕ 0 Points</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.8 }}>Investor Relations · LP Communications · Marketing · Business Dev · Portfolio company contacts</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Point System</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[{ s: "M1", m: "1.0×", c: T.green }, { s: "M2", m: "1.5×", c: T.yellow }, { s: "M3+", m: "2.25×", c: T.red }].map((x, i) => (
                  <div key={i} style={{ flex: "1 1 100px", background: `${x.c}0C`, border: `1px solid ${x.c}25`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono'", color: x.c }}>{x.m}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{x.s}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: `${T.red}0A`, border: `1px solid ${T.red}25`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6 }}>⚠️ Zero Tolerance — Collusion</div>
              <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7 }}>No AE may direct or arrange with an SDR to prospect specific accounts. Violation = immediate AE team DQ. SDR keeps points. Salesforce = source of truth.</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 20, textAlign: "center", borderTop: `1px solid ${T.cardBorder}`, marginTop: 40 }}>
        <div style={{ fontSize: 10, color: T.textFaint, fontFamily: "'Space Mono'", letterSpacing: 1 }}>MAYBERN · APRIL PIPELINE BLITZ 2026 · APR 1–30</div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pd { animation: pulse 2s infinite; }
        * { box-sizing: border-box; }
        button { cursor: pointer; transition: opacity 0.15s, transform 0.1s; }
        button:hover { opacity: 0.85; }
        button:active { transform: scale(0.95); }
        input::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(1) saturate(3) hue-rotate(120deg); }
        select option { background: #0d2922; color: #E2F5F0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.accent}22; border-radius: 3px; }
      `}</style>
    </div>
  );
}
