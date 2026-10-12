/* ==========================================================
   app.js – state, tabs, filters, forms and events
   ========================================================== */
(() => {
  "use strict";

  /* ---------- Login guard ---------- */
  const user = Auth.currentUser();
  if (!user) {
    location.replace("index.html");
    return;
  }

  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);

  function makeId() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "t" + Date.now() + Math.random().toString(16).slice(2);
  }

  function isoDate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  /* ---------- Starter data for a brand-new student ---------- */
  function seedData() {
    const sub = (name, type) => ({ id: makeId(), name, type, attendance: [] });
    const subjects = [
      sub("Mathematics", "theory"),
      sub("Physics", "theory"),
      sub("Physics Lab", "lab"),
      sub("Programming Lab", "lab")
    ];

    const now = Date.now();
    const task = (i, subjectIndex, title, description, dueOffset, priority) => ({
      id: makeId(),
      subjectId: subjects[subjectIndex].id,
      title, description,
      dueDate: isoDate(dueOffset),
      priority,
      completed: false,
      createdAt: now - i * 1000
    });

    return {
      subjects,
      tasks: [
        task(3, 2, "Physics lab report", "Write the conclusion and add graphs for experiment 4.", 2, "high"),
        task(2, 0, "Solve Chapter 5 problems", "Questions 1–20 from the exercise.", 5, "medium"),
        task(1, 3, "Finish loop programs", "Complete the 5 practice programs.", 7, "low")
      ]
    };
  }

  /* ---------- State ---------- */
  let data = Store.getData(user.id) || seedData();
  if (!Array.isArray(data.subjects)) data.subjects = [];
  if (!Array.isArray(data.tasks)) data.tasks = [];

  const filters = { status: "all", priority: "all", type: "all", subject: "all", search: "", sort: "due" };

  function commit() {
    Store.saveData(user.id, data);
    render();
  }

  /* ---------- Filtering & sorting ---------- */
  const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

  function getVisibleTasks() {
    const q = filters.search.trim().toLowerCase();

    const result = data.tasks.filter((t) => {
      const subject = data.subjects.find((s) => s.id === t.subjectId);

      if (filters.status === "pending"   && t.completed)  return false;
      if (filters.status === "completed" && !t.completed) return false;
      if (filters.priority !== "all" && t.priority !== filters.priority) return false;
      if (filters.type !== "all" && (!subject || subject.type !== filters.type)) return false;

      if (filters.subject !== "all") {
        const wanted = filters.subject === "__none" ? "" : filters.subject;
        if ((t.subjectId || "") !== wanted) return false;
      }

      if (q) {
        const haystack = `${t.title} ${t.description} ${subject ? subject.name : ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1; // done sinks to bottom

      switch (filters.sort) {
        case "priority":
          return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
              || (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
        case "newest":
          return b.createdAt - a.createdAt;
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99")
              || PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      }
    });

    return result;
  }

  /* ---------- Render everything ---------- */
  function render() {
    UI.fillSubjectSelects(data.subjects, filters.subject);
    UI.renderOverview(data);
    UI.renderTasks(getVisibleTasks(), data.subjects);
    UI.renderAttendanceCheck(data.subjects, $("att-date").value);
    UI.renderAttendanceTable(data.subjects);
    UI.renderSubjects(data);
  }

  /* ==========================================================
     Header, logout, tabs
     ========================================================== */
  $("welcome").textContent = `Welcome, ${user.name} (${user.rollNo})`;

  $("logout-btn").addEventListener("click", () => {
    Auth.logout();
    location.href = "index.html";
  });

  function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.hidden = p.id !== `tab-${name}`;
    });
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => showTab(tab.dataset.tab));
  });

  /* ==========================================================
     Task dialog (add / edit)
     ========================================================== */
  const dialog = $("task-dialog");

  function openDialog(task) {
    const editing = !!task;
    $("dialog-title").textContent = editing ? "Edit task" : "Add task";
    $("save-btn").textContent = editing ? "Save changes" : "Add task";

    $("task-id").value = editing ? task.id : "";
    $("task-title").value = editing ? task.title : "";
    $("task-subject").value = editing ? (task.subjectId || "") : "";
    $("task-desc").value = editing ? task.description : "";
    $("task-due").value = editing ? task.dueDate : "";
    $("task-priority").value = editing ? task.priority : "medium";

    $("task-title").classList.remove("invalid");
    $("title-error").hidden = true;

    dialog.showModal();
    $("task-title").focus();
  }

  $("add-btn").addEventListener("click", () => openDialog(null));
  $("cancel-btn").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  $("task-title").addEventListener("input", () => {
    $("task-title").classList.remove("invalid");
    $("title-error").hidden = true;
  });

  $("task-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const title = $("task-title").value.trim();
    if (!title) {
      $("task-title").classList.add("invalid");
      $("title-error").hidden = false;
      $("task-title").focus();
      return;
    }

    const fields = {
      title,
      subjectId: $("task-subject").value,
      description: $("task-desc").value.trim(),
      dueDate: $("task-due").value,
      priority: $("task-priority").value
    };

    const id = $("task-id").value;
    if (id) {
      data.tasks = data.tasks.map((t) => (t.id === id ? { ...t, ...fields } : t));
    } else {
      data.tasks.push({ id: makeId(), completed: false, createdAt: Date.now(), ...fields });
    }

    commit();
    dialog.close();
  });

  /* ==========================================================
     Task card actions
     ========================================================== */
  $("task-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const task = data.tasks.find((t) => t.id === btn.closest("[data-id]").dataset.id);
    if (!task) return;

    if (btn.dataset.action === "edit") openDialog(task);

    if (btn.dataset.action === "delete" && confirm(`Delete "${task.title}"?`)) {
      data.tasks = data.tasks.filter((t) => t.id !== task.id);
      commit();
    }
  });

  $("task-list").addEventListener("change", (e) => {
    if (e.target.dataset.action !== "toggle") return;
    const id = e.target.closest("[data-id]").dataset.id;
    data.tasks = data.tasks.map((t) => (t.id === id ? { ...t, completed: e.target.checked } : t));
    commit();
  });

  /* ---------- Filters, search, sort ---------- */
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.filter;
      filters[group] = chip.dataset.value;

      document.querySelectorAll(`.chip[data-filter="${group}"]`).forEach((c) => {
        const active = c === chip;
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });

  $("search").addEventListener("input", (e) => { filters.search = e.target.value; render(); });
  $("sort").addEventListener("change", (e) => { filters.sort = e.target.value; render(); });
  $("subject-filter").addEventListener("change", (e) => { filters.subject = e.target.value; render(); });

  $("clear-done").addEventListener("click", () => {
    const count = data.tasks.filter((t) => t.completed).length;
    if (count === 0) return alert("There are no completed tasks to clear.");
    if (confirm(`Remove ${count} completed task${count === 1 ? "" : "s"}?`)) {
      data.tasks = data.tasks.filter((t) => !t.completed);
      commit();
    }
  });

  /* ==========================================================
     Attendance
     ========================================================== */
  const dateInput = $("att-date");
  dateInput.value = isoDate(0);
  dateInput.max = isoDate(0);              // can't mark attendance in the future

  dateInput.addEventListener("change", render);

  $("att-check").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const date = dateInput.value;
    if (!date) return alert("Please pick a date first.");

    const subject = data.subjects.find((s) => s.id === btn.dataset.id);
    if (!subject) return;

    if (btn.dataset.action === "clear") Attendance.clear(subject, date);
    else Attendance.mark(subject, date, btn.dataset.action === "present");

    commit();
  });

  $("att-all-present").addEventListener("click", () => {
    const date = dateInput.value;
    if (!date) return alert("Please pick a date first.");
    if (data.subjects.length === 0) return alert("Add subjects first.");

    data.subjects.forEach((s) => Attendance.mark(s, date, true));
    commit();
  });

  /* ==========================================================
     Subjects
     ========================================================== */
  $("subject-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const name = $("subject-name").value.trim();
    const type = $("subject-type").value;
    const error = $("subject-error");

    if (!name) {
      error.textContent = "Please enter a subject name.";
      error.hidden = false;
      return;
    }

    const duplicate = data.subjects.some(
      (s) => s.name.toLowerCase() === name.toLowerCase() && s.type === type
    );
    if (duplicate) {
      error.textContent = "That subject already exists.";
      error.hidden = false;
      return;
    }

    error.hidden = true;
    data.subjects.push({ id: makeId(), name, type, attendance: [] });
    $("subject-name").value = "";
    commit();
  });

  $("subject-list").addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="delete-subject"]');
    if (!btn) return;

    const subject = data.subjects.find((s) => s.id === btn.closest("[data-id]").dataset.id);
    if (!subject) return;

    const ok = confirm(`Delete "${subject.name}"?\nThis also deletes its tasks and attendance records.`);
    if (!ok) return;

    data.subjects = data.subjects.filter((s) => s.id !== subject.id);
    data.tasks = data.tasks.filter((t) => t.subjectId !== subject.id);
    if (filters.subject === subject.id) filters.subject = "all";
    commit();
  });

  /* ---------- Go! ---------- */
  render();
})();