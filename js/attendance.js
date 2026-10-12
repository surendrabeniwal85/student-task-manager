/* ==========================================================
   attendance.js – attendance calculations
   ========================================================== */
const Attendance = (() => {
  const TARGET = 75; // minimum % most colleges require

  function build(total, present) {
    const absent = total - present;
    const percent = total ? (present / total) * 100 : 0;
    const t = TARGET / 100;

    // How many more classes can be missed and still stay ≥ 75%
    const canMiss = total ? Math.max(0, Math.floor(present / t - total)) : 0;

    // How many consecutive classes must be attended to reach 75%
    const need = percent >= TARGET ? 0 : Math.ceil((t * total - present) / (1 - t));

    return { total, present, absent, percent, canMiss, need, safe: total === 0 || percent >= TARGET };
  }

  function subjectStats(subject) {
    const records = subject.attendance || [];
    return build(records.length, records.filter((r) => r.present).length);
  }

  /** Combined stats for all subjects, or only "lab" / "theory". */
  function overall(subjects, type) {
    const list = type ? subjects.filter((s) => s.type === type) : subjects;
    let total = 0;
    let present = 0;
    list.forEach((s) => {
      const records = s.attendance || [];
      total += records.length;
      present += records.filter((r) => r.present).length;
    });
    return build(total, present);
  }

  function find(subject, date) {
    return (subject.attendance || []).find((r) => r.date === date);
  }

  /** Marks present/absent for a date (replaces any earlier mark for that date). */
  function mark(subject, date, present) {
    subject.attendance = subject.attendance || [];
    const existing = find(subject, date);
    if (existing) existing.present = present;
    else subject.attendance.push({ date, present });
  }

  function clear(subject, date) {
    subject.attendance = (subject.attendance || []).filter((r) => r.date !== date);
  }

  return { TARGET, subjectStats, overall, find, mark, clear };
})();