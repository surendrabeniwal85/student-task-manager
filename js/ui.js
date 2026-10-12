/* ==========================================================
   ui.js – builds and renders every part of the interface
   ========================================================== */
const UI = (() => {
  const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };
  const TYPE_LABEL = { lab: "Lab", theory: "Theory" };

  const $ = (id) => document.getElementById(id);

  /* ---------- Small helpers ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function td(content, className) {
    const cell = el("td", className);
    if (content instanceof Node) cell.append(content);
    else cell.textContent = content;
    return cell;
  }

  const fmtPercent = (n) => `${Math.round(n * 10) / 10}%`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function typeTag(type) {
    return el("span", `tag tag--${type}`, TYPE_LABEL[type]);
  }

  function miniBar(percent, safe) {
    const bar = el("span", "mini-bar" + (safe ? "" : " is-low"));
    const fill = el("span");
    fill.style.width = Math.min(100, percent) + "%";
    bar.append(fill);
    return bar;
  }

  function advice(st) {
    if (st.total === 0) return { text: "No classes marked yet", cls: "" };
    if (st.safe) {
      return st.canMiss > 0
        ? { text: `Safe – can miss ${plural(st.canMiss, "more class")}`, cls: "good" }
        : { text: "On the edge – don't miss!", cls: "good" };
    }
    return { text: `Attend next ${plural(st.need, "class")} to reach ${Attendance.TARGET}%`, cls: "bad" };
  }

  /* ---------- Date helpers (local time) ---------- */
  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function startOfToday() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function daysUntil(str) {
    return Math.round((parseDate(str) - startOfToday()) / 86400000);
  }

  function isOverdue(task) {
    return !task.completed && !!task.dueDate && daysUntil(task.dueDate) < 0;
  }

  function dueInfo(task) {
    if (!task.dueDate) return { text: "📅 No due date", state: "" };

    const nice = parseDate(task.dueDate).toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric"
    });

    if (task.completed) return { text: `📅 Due ${nice}`, state: "" };

    const n = daysUntil(task.dueDate);
    if (n < 0)   return { text: `⚠️ Overdue by ${plural(-n, "day")} · ${nice}`, state: "is-overdue" };
    if (n === 0) return { text: `⏰ Due today · ${nice}`, state: "is-soon" };
    if (n === 1) return { text: `⏰ Due tomorrow · ${nice}`, state: "is-soon" };
    return { text: `📅 Due in ${n} days · ${nice}`, state: n <= 3 ? "is-soon" : "" };
  }

  /* ==========================================================
     OVERVIEW TAB
     ========================================================== */
  function renderOverview({ subjects, tasks }) {
    /* --- Attendance cards --- */
    const att = Attendance.overall(subjects);
    $("att-total").textContent = att.total;
    $("att-present").textContent = att.present;
    $("att-percent").textContent = fmtPercent(att.percent);

    const status = $("att-status");
    status.classList.remove("is-good", "is-bad");
    if (att.total === 0) {
      status.textContent = "No data";
    } else if (att.safe) {
      status.textContent = "Safe ✅";
      status.classList.add("is-good");
    } else {
      status.textContent = "Low ⚠️";
      status.classList.add("is-bad");
    }

    const attBar = $("att-bar");
    attBar.style.width = Math.min(100, att.percent) + "%";
    attBar.classList.toggle("is-low", att.total > 0 && !att.safe);
    $("att-progress").setAttribute("aria-valuenow", Math.round(att.percent));

    const theory = Attendance.overall(subjects, "theory");
    const lab = Attendance.overall(subjects, "lab");
    $("att-types").textContent =
      `Theory: ${theory.total ? fmtPercent(theory.percent) : "–"}  ·  Lab: ${lab.total ? fmtPercent(lab.percent) : "–"}`;

    /* --- Work cards --- */
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    const pending = total - done;
    const overdue = tasks.filter(isOverdue).length;
    const percentDone = total ? Math.round((done / total) * 100) : 0;

    $("stat-total").textContent = total;
    $("stat-pending").textContent = pending;
    $("stat-done").textContent = done;
    $("stat-overdue").textContent = overdue;

    $("progress-bar").style.width = percentDone + "%";
    $("progress").setAttribute("aria-valuenow", percentDone);
    $("progress-text").textContent = total
      ? `${percentDone}% completed · ${plural(pending, "task")} left (${100 - percentDone}%)`
      : "No tasks yet";

    /* --- Subject summary table --- */
    const body = $("summary-table").tBodies[0];
    if (subjects.length === 0) {
      const row = el("tr");
      const cell = td("Add subjects in the Subjects tab to see your summary.", "empty-cell");
      cell.colSpan = 6;
      row.append(cell);
      body.replaceChildren(row);
      return;
    }

    const rows = subjects.map((s) => {
      const st = Attendance.subjectStats(s);
      const mine = tasks.filter((t) => t.subjectId === s.id);
      const doneCount = mine.filter((t) => t.completed).length;
      const left = mine.length - doneCount;

      const attCell = el("span");
      attCell.append(
        miniBar(st.percent, st.safe),
        document.createTextNode(st.total ? `${fmtPercent(st.percent)} (${st.present}/${st.total})` : "–")
      );

      const row = el("tr");
      row.append(
        td(s.name),
        td(typeTag(s.type)),
        td(attCell),
        td(left, left ? "bad" : "good"),
        td(doneCount),
        td(left === 0 ? "All done 🎉" : plural(left, "task"))
      );
      return row;
    });
    body.replaceChildren(...rows);
  }

  /* ==========================================================
     TASKS TAB
     ========================================================== */
  function createCard(task, subjects) {
    const card = el("article", `task task--${task.priority}`);
    if (task.completed) card.classList.add("is-completed");
    card.dataset.id = task.id;

    // Top row
    const top = el("div", "task-top");
    const check = el("label", "check");
    const box = el("input");
    box.type = "checkbox";
    box.checked = task.completed;
    box.dataset.action = "toggle";
    box.setAttribute("aria-label", `Mark "${task.title}" as completed`);
    check.append(box, el("span", "", task.completed ? "Completed" : "Mark done"));
    top.append(check, el("span", "badge", PRIORITY_LABEL[task.priority]));

    // Subject line
    const subject = subjects.find((s) => s.id === task.subjectId);
    const subjectLine = el("div", "task-subject");
    if (subject) subjectLine.append(typeTag(subject.type), el("span", "", subject.name));
    else subjectLine.append(el("span", "", "General (no subject)"));

    const title = el("h3", "task-title", task.title);
    const desc = task.description ? el("p", "task-desc", task.description) : null;

    const info = dueInfo(task);
    const due = el("div", `task-due ${info.state}`.trim(), info.text);

    // Actions
    const actions = el("div", "task-actions");
    const edit = el("button", "btn btn-edit", "✏️ Edit");
    edit.type = "button";
    edit.dataset.action = "edit";
    const del = el("button", "btn btn-delete", "🗑 Delete");
    del.type = "button";
    del.dataset.action = "delete";
    actions.append(edit, del);

    card.append(top, title, subjectLine);
    if (desc) card.append(desc);
    card.append(due, actions);
    return card;
  }

  function renderTasks(visibleTasks, subjects) {
    $("task-list").replaceChildren(...visibleTasks.map((t) => createCard(t, subjects)));
    $("empty").hidden = visibleTasks.length > 0;
  }

  /** Rebuilds the subject dropdowns (filter + task form). */
  function fillSubjectSelects(subjects, currentFilter) {
    const filter = $("subject-filter");
    const filterOptions = [new Option("All subjects", "all"), new Option("General (no subject)", "__none")];
    subjects.forEach((s) => filterOptions.push(new Option(`${s.name} (${TYPE_LABEL[s.type]})`, s.id)));
    filter.replaceChildren(...filterOptions);
    filter.value = currentFilter;

    const form = $("task-subject");
    const formOptions = [new Option("General (no subject)", "")];
    subjects.forEach((s) => formOptions.push(new Option(`${s.name} (${TYPE_LABEL[s.type]})`, s.id)));
    const keep = form.value;
    form.replaceChildren(...formOptions);
    form.value = keep;
  }

  /* ==========================================================
     ATTENDANCE TAB
     ========================================================== */
  function renderAttendanceCheck(subjects, date) {
    const box = $("att-check");

    if (subjects.length === 0) {
      box.replaceChildren(el("p", "empty", "Add subjects first (Subjects tab)."));
      return;
    }

    const parts = [];
    [["theory", "Theory subjects"], ["lab", "Lab subjects"]].forEach(([type, heading]) => {
      const group = subjects.filter((s) => s.type === type);
      if (group.length === 0) return;

      parts.push(el("h3", "att-group-title", heading));

      group.forEach((s) => {
        const record = date ? Attendance.find(s, date) : null;

        const row = el("div", "att-row");
        row.append(el("div", "att-name", s.name));

        const label = !record ? "Not marked" : record.present ? "Present" : "Absent";
        const cls = !record ? "" : record.present ? " is-present" : " is-absent";
        row.append(el("span", "att-status" + cls, label));

        const buttons = el("div", "att-buttons");
        const mk = (text, action, extra) => {
          const b = el("button", `btn ${extra}`, text);
          b.type = "button";
          b.dataset.action = action;
          b.dataset.id = s.id;
          return b;
        };

        const present = mk("✔ Present", "present", "btn-present");
        const absent = mk("✖ Absent", "absent", "btn-absent");
        if (record && record.present) present.classList.add("is-on");
        if (record && !record.present) absent.classList.add("is-on");

        buttons.append(present, absent, mk("Clear", "clear", "btn-ghost"));
        row.append(buttons);
        parts.push(row);
      });
    });

    box.replaceChildren(...parts);
  }

  function renderAttendanceTable(subjects) {
    const body = $("att-table").tBodies[0];

    if (subjects.length === 0) {
      const row = el("tr");
      const cell = td("No subjects yet.", "empty-cell");
      cell.colSpan = 7;
      row.append(cell);
      body.replaceChildren(row);
      return;
    }

    const rows = subjects.map((s) => {
      const st = Attendance.subjectStats(s);
      const tip = advice(st);

      const pct = el("span");
      pct.append(
        miniBar(st.percent, st.safe),
        document.createTextNode(st.total ? fmtPercent(st.percent) : "–")
      );

      const row = el("tr");
      row.append(
        td(s.name),
        td(typeTag(s.type)),
        td(st.present),
        td(st.total),
        td(st.absent),
        td(pct),
        td(tip.text, tip.cls)
      );
      return row;
    });
    body.replaceChildren(...rows);
  }

  /* ==========================================================
     SUBJECTS TAB
     ========================================================== */
  function renderSubjects({ subjects, tasks }) {
    const list = $("subject-list");

    if (subjects.length === 0) {
      list.replaceChildren(el("p", "empty", "No subjects yet. Add your first one above."));
      return;
    }

    const cards = subjects.map((s) => {
      const st = Attendance.subjectStats(s);
      const mine = tasks.filter((t) => t.subjectId === s.id);
      const left = mine.filter((t) => !t.completed).length;

      const card = el("div", "subject-card");
      card.dataset.id = s.id;

      const del = el("button", "btn btn-delete", "🗑 Delete");
      del.type = "button";
      del.dataset.action = "delete-subject";

      card.append(
        el("h3", "", s.name),
        typeTag(s.type),
        el("p", "subject-meta", `Attendance: ${st.total ? `${fmtPercent(st.percent)} (${st.present}/${st.total})` : "no classes yet"}`),
        el("p", "subject-meta", `Tasks: ${mine.length} total · ${left} left`),
        del
      );
      return card;
    });

    list.replaceChildren(...cards);
  }

  return {
    renderOverview, renderTasks, fillSubjectSelects,
    renderAttendanceCheck, renderAttendanceTable, renderSubjects,
    isOverdue
  };
})();