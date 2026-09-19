"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, Heart, Info, Leaf, LoaderCircle, Plus, Sparkles, Users, X } from "lucide-react";
import roster from "@/data/leave-calendar.json";
import "./leave-calendar.css";

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const leaveTypes = [{ name: "Annual leave", description: "Time to recharge", Icon: Leaf }, { name: "Personal leave", description: "Health & wellbeing", Icon: Heart }, { name: "Carer’s leave", description: "Looking after others", Icon: Users }, { name: "Other leave", description: "Something else", Icon: Plus }];
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (value: string) => new Date(`${value}T12:00:00`);
const dateLabel = (value: string) => value ? parse(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Choose a date";
const inLoadedMonth = (value: string) => value >= roster.loadedFrom && value <= roster.loadedThrough;

export default function LeaveCalendar({ onCheck, running, note, onNoteChange }: { onCheck: (note: string) => void; running: boolean; note: string; onNoteChange: (note: string) => void }) {
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [start, setStart] = useState("2026-09-21");
  const [end, setEnd] = useState("2026-09-21");
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState("Annual leave");
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const validRange = Boolean(start && end && start <= end);
  const loadedRange = validRange && inLoadedMonth(start) && inLoadedMonth(end);
  const selectedShifts = validRange ? roster.shifts.filter(shift => shift.date >= start && shift.date <= end) : [];
  const netHours = selectedShifts.reduce((sum, shift) => sum + shift.netHours, 0);
  const days = validRange ? Math.round((parse(end).getTime() - parse(start).getTime()) / 86400000) + 1 : 0;
  const canCheck = start === "2026-09-21" && end === "2026-09-21" && leaveType === "Annual leave";

  function selectDay(value: string) {
    if (rangeAnchor) {
      setStart(value < rangeAnchor ? value : rangeAnchor);
      setEnd(value < rangeAnchor ? rangeAnchor : value);
      setRangeAnchor(null);
    } else {
      setStart(value); setEnd(value); setRangeAnchor(value);
    }
  }
  function today() {
    const current = new Date();
    setMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setStart(key(current)); setEnd(key(current)); setRangeAnchor(null);
  }

  return <div className="lc-root">
    <div className="lc-page-intro"><div><span className="lc-kicker">YOUR TIME, THOUGHTFULLY PLANNED</span><h1>A little time off. A lot to look forward to.</h1><p>Choose your dates. We’ll help you see what needs to happen next.</p></div><div className="lc-person"><span>SC</span><div><strong>Sarah Chen</strong><small>Resident Medical Officer</small></div></div></div>
    <div className="lc-layout">
      <div className="lc-main">
        <section className="lc-card lc-calendar-card" aria-label="Leave calendar">
          <div className="lc-calendar-heading"><div><span className="lc-step">01</span><h2>When would you like a break?</h2></div><button className="lc-today" onClick={today}>Today</button></div>
          <div className="lc-month-heading"><h3>{month.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</h3><div><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={19} /></button><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={19} /></button></div></div>
          <div className="lc-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
          <div className="lc-days">{Array.from({ length: cells }, (_, index) => {
            const date = new Date(month.getFullYear(), month.getMonth(), index - offset + 1);
            const value = key(date);
            const outside = date.getMonth() !== month.getMonth();
            const shifts = roster.shifts.filter(shift => shift.date === value);
            const selected = validRange && value >= start && value <= end;
            const loaded = inLoadedMonth(value);
            return <button key={value} className={`lc-day${outside ? " lc-outside" : ""}${selected ? " lc-selected" : ""}${shifts.length ? " lc-rostered" : ""}${!loaded ? " lc-unknown" : ""}`} onClick={() => selectDay(value)} aria-pressed={selected} aria-label={`${dateLabel(value)}, ${!loaded ? "roster data unavailable" : shifts.length ? `${shifts.length} rostered shift${shifts.length === 1 ? "" : "s"}` : "no assignment in source roster"}${selected ? ", selected" : ""}`}><span className="lc-date-number">{date.getDate()}</span>{selected ? <span className="lc-day-text"><Check size={11} />Selected</span> : shifts.length ? <span className="lc-shift-dot" aria-hidden="true" /> : null}</button>;
          })}</div>
          <div className="lc-legend"><span><i className="lc-dot-selected" />Selected leave</span><span><i className="lc-dot-rostered" />Rostered shift</span><span><i className="lc-dot-empty" />No roster assignment</span></div>
          <div className="lc-calendar-help"><Info size={15} /><p>{rangeAnchor ? "Choose another date to extend your selection, or keep this day." : "Select a day, then another to choose a range. You can also enter dates below."}</p></div>
          {!inLoadedMonth(key(month)) && <div className="lc-unknown-note">Roster data is not loaded for this month. Availability is unknown.</div>}
          <div className="lc-date-inputs"><label>From<input type="date" value={start} onChange={event => { setStart(event.target.value); setRangeAnchor(null); }} /></label><ArrowRight size={18} /><label>To<input type="date" value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); setRangeAnchor(null); }} /></label></div>
          {start && end && start > end && <p className="lc-error" role="alert">The end date must be on or after the start date.</p>}
        </section>
        <section className="lc-card lc-process"><h2><Info size={21}/>What happens next?</h2><p>Plan your dates here, then follow the existing leave process.</p><div><article><span>1</span><strong>Submit to HSS</strong><small>Use the centrally managed leave form.</small></article><article><span>2</span><strong>Supervisor review</strong><small>Staffing, skills and planned leave checked.</small></article><article><span>3</span><strong>Payroll updated</strong><small>Approved leave appears on your payslip.</small></article></div></section>
      </div>
      <aside className="lc-summary-column"><section className="lc-card lc-summary"><div className="lc-summary-top"><span className="lc-summary-icon"><CalendarDays size={22} /></span><div><span className="lc-kicker"></span><h2>Selected leave period</h2></div></div><div className="lc-selected-type"><Leaf size={18} /><strong>{leaveType}</strong><span>{days ? `${days} ${days === 1 ? "day" : "days"}` : "No dates"}</span></div><div className="lc-summary-dates"><div><span>FROM</span><strong>{dateLabel(start)}</strong></div><ArrowRight size={17} /><div><span>TO</span><strong>{dateLabel(end)}</strong></div></div><div className="lc-total"><span>Rostered hours in selection</span><strong>{validRange ? `${netHours}${loadedRange ? "" : "+"}` : "—"}<small>{validRange ? " hours" : ""}</small></strong></div>{!loadedRange && validRange && <p className="lc-source-caution">Only September roster hours are included. Availability outside that month is unknown.</p>}<div className="lc-balance"><Clock3 size={17} /><div><strong>Leave balance needs checking</strong><p>A balance effective at the decision date is not available.</p></div></div><div className="lc-shifts"><h3>{selectedShifts.length ? `Your affected ${selectedShifts.length === 1 ? "shift" : "shifts"}` : "Your affected shifts"}</h3>{selectedShifts.length ? selectedShifts.map((shift, index) => <div className="lc-shift" key={`${shift.date}-${index}`}><span className="lc-shift-date">{parse(shift.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span><div><strong>{shift.start}–{shift.end}</strong><small>{shift.unit} · {shift.netHours} net hours</small></div></div>) : <p>{validRange ? loadedRange ? "No roster assignment appears in the source for these dates. This does not establish leave eligibility." : "No loaded roster assignments match these dates." : "Select dates to see your rostered shifts."}</p>}</div>        <section className="lc-type-card"><div className="lc-section-heading"><span className="lc-step">02</span><h2>Leave type</h2></div><div className="lc-leave-types">{leaveTypes.map(({ name, description, Icon }) => <button key={name} className={leaveType === name ? "lc-type-selected" : ""} onClick={() => setLeaveType(name)} aria-pressed={leaveType === name}><span className="lc-type-icon"><Icon size={22} /></span>{leaveType === name && <Check size={13} className="lc-type-check" />}<strong>{name}</strong><small>{description}</small></button>)}</div></section>
        <section className="lc-note-card"><div className="lc-section-heading"><span className="lc-step">03</span><h2>Add an optional note</h2><span className="lc-optional">Optional</span></div><label className="lc-note-label" htmlFor="lc-note">Your note<textarea id="lc-note" value={note} onChange={event => onNoteChange(event.target.value)} placeholder="A little context for your manager, if you’d like…" rows={3} maxLength={300} /></label><span className="lc-note-hint">{note.length}/300 · Optional context for your supervisor</span></section><button className="lc-check-button" onClick={() => { if (canCheck && !running) onCheck(note); }} disabled={!canCheck || running}>{running ? <LoaderCircle size={19} className="lc-spinner" /> : <Sparkles size={19} />}<span>{running ? "Checking your leave…" : "Check my leave"}</span><ArrowRight size={19} /></button>{!canCheck && validRange && <p className="lc-unavailable" role="status">{leaveType !== "Annual leave" && start === "2026-09-21" && end === "2026-09-21" ? "Assessment data is not available for this leave type." : "Assessment data is not available for this period."}</p>}<p className="lc-check-caption">We’ll review leave, your roster and the evidence needed for a decision.</p><button className="lc-clear" onClick={() => { setStart(""); setEnd(""); setRangeAnchor(null); }} disabled={!start && !end}><X size={13} />Clear selection</button></section><section className="lc-human-note"><span><Users size={19} /></span><div><h3>A conversation, not just a request.</h3><p>See the options together. Your manager makes the final decision.</p></div></section><details className="lc-source-details"><summary><FileText size={14} />Where this information comes from<ChevronRight size={14} /></summary><p>Sarah Chen is the display name for source employee <strong>{roster.employeeId}</strong>.</p><p>Roster source: {roster.sourceFile}. Loaded period: 1–30 September 2026. {roster.shifts.length} roster assignments.</p><p>Net hours = shift duration − recorded meal break. No roster assignment does not mean staffing or leave approval is available.</p></details></aside>
    </div>
  </div>;
}
