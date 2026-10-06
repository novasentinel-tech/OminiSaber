/* Pure presentation data. The dashboard never substitutes sample records for school data. */
const rows = (value) => Array.isArray(value) ? value : [];
const timestamp = (value) => {
  if (!value) return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
};
const score = (value) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) ? Number(value) : null;
const dayNumber = (value) => {
  const date = new Date(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
};

export const dashboardDeadlineLabel = (value, now = new Date()) => {
  if (timestamp(value) === null) return "Sem prazo";
  const remaining = dayNumber(value) - dayNumber(now);
  if (remaining < 0) return "Prazo encerrado";
  if (!remaining) return "Hoje";
  if (remaining === 1) return "Amanhã";
  return `Em ${remaining} dias`;
};

export const latestEvaluationAttempts = (results) => {
  const latest = new Map();
  for (const item of rows(results)) {
    if (!item.aluno_id) continue;
    const current = latest.get(item.aluno_id);
    const number = Number(item.numero_tentativa) || 0;
    const currentNumber = Number(current?.numero_tentativa) || 0;
    if (!current || number > currentNumber || (number === currentNumber && (timestamp(item.enviada_em) || 0) > (timestamp(current.enviada_em) || 0))) latest.set(item.aluno_id, item);
  }
  return [...latest.values()];
};

export const buildDashboardSummary = ({ classes = [], studentCount = 0, labs = [], evaluations = [], essays = [], evaluationResults = [], resultsUnavailable = false, essaysUnavailable = false, now = new Date() } = {}) => {
  const linkedClasses = rows(classes);
  const classIds = new Set(linkedClasses.map((item) => item.id));
  const scoped = (items) => rows(items).filter((item) => !item.turma_id || classIds.has(item.turma_id));
  const activities = scoped(evaluations);
  const laboratories = scoped(labs);
  const evaluationsById = new Map(activities.map((item) => [item.id, item]));
  const pendingEvaluations = activities.reduce((sum, item) => sum + rows(item.tentativas_avaliacao).filter((attempt) => attempt.status === "enviada").length, 0);
  const pendingLabs = laboratories.reduce((sum, item) => sum + rows(item.entregas_laboratorio).filter((attempt) => attempt.status === "enviada").length, 0);
  const pendingEssays = rows(essays).filter((item) => item.status === "enviada" && classIds.has(item.perfis?.turma_id)).length;
  const drafts = activities.filter((item) => item.status === "rascunho").length;
  const nowTime = new Date(now).getTime();
  const deadlines = [
    ...activities.map((item) => ({ ...item, kind: "evaluation", deadline: item.encerra_em })),
    ...laboratories.map((item) => ({ ...item, kind: "lab", deadline: item.prazo })),
  ].filter((item) => item.status === "publicado" && classIds.has(item.turma_id) && timestamp(item.deadline) !== null && timestamp(item.deadline) >= nowTime)
    .sort((left, right) => timestamp(left.deadline) - timestamp(right.deadline));
  const latestByStudent = new Map();
  const samples = [];
  for (const entry of rows(evaluationResults)) {
    const evaluation = evaluationsById.get(entry.evaluation?.id);
    if (!evaluation || evaluation.status === "rascunho" || !classIds.has(evaluation.turma_id) || !(Number(evaluation.valor) > 0)) continue;
    const graded = latestEvaluationAttempts(entry.results).filter((item) => item.status === "corrigida" && !item.requer_revisao && score(item.nota) !== null && score(item.nota) >= 0 && score(item.nota) <= Number(evaluation.valor));
    for (const item of graded) {
      const correctedAt = timestamp(item.corrigida_em);
      const percentage = Number(item.nota) / Number(evaluation.valor) * 100;
      const sample = { ...item, evaluation, percentage, correctedAt };
      if (correctedAt !== null && correctedAt <= nowTime) samples.push(sample);
      const prior = latestByStudent.get(item.aluno_id);
      // Without a correction date, we cannot call a result the student's latest evidence.
      if (correctedAt !== null && correctedAt <= nowTime && (!prior || correctedAt > prior.correctedAt)) latestByStudent.set(item.aluno_id, sample);
    }
  }
  const support = [...latestByStudent.values()].filter((item) => item.percentage < 60).sort((left, right) => left.percentage - right.percentage);
  const weeks = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - offset * 7 + 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    weeks.push({ start: start.getTime(), end: end.getTime(), label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(start) });
  }
  const series = linkedClasses.map((classItem) => ({
    id: classItem.id,
    label: classItem.nome,
    points: weeks.map((week) => {
      const entries = samples.filter((sample) => sample.evaluation.turma_id === classItem.id && sample.correctedAt >= week.start && sample.correctedAt < week.end);
      return { value: entries.length ? entries.reduce((sum, sample) => sum + sample.percentage, 0) / entries.length : null, count: entries.length };
    }),
  })).filter((item) => item.points.some((point) => point.count));
  return {
    classes: linkedClasses.map((item) => ({ ...item, activityCount: activities.filter((evaluation) => evaluation.turma_id === item.id && evaluation.status !== "rascunho").length })),
    studentCount: Math.max(0, Number(studentCount) || 0),
    pending: { evaluations: pendingEvaluations, labs: pendingLabs, essays: pendingEssays, total: pendingEvaluations + pendingLabs + pendingEssays },
    drafts,
    deadlines,
    dueSoon: deadlines.filter((item) => dayNumber(item.deadline) - dayNumber(now) <= 5),
    nextDeadline: deadlines[0] || null,
    support,
    assessedStudents: latestByStudent.size,
    resultsUnavailable,
    essaysUnavailable,
    chart: { weeks, series, count: series.reduce((sum, item) => sum + item.points.reduce((total, point) => total + point.count, 0), 0) },
  };
};

export const drawDashboardChart = (canvas, chart, selectedClass = "") => {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.clientWidth || 430;
  const height = canvas.clientHeight || 172;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  context.scale(scale, scale);
  const left = 29, top = 12, bottom = height - 26, right = width - 14;
  const colors = ["#1464e9", "#7b4bd1", "#16947d", "#c07716", "#ba416e"];
  context.font = "10px Inter, sans-serif";
  context.textAlign = "right";
  for (let value = 0; value <= 100; value += 25) {
    const y = bottom - (bottom - top) * value / 100;
    context.fillStyle = "#667893";
    context.fillText(`${value}`, left - 8, y + 3);
    context.strokeStyle = "#e8eef6";
    context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
  }
  context.textAlign = "center";
  chart.weeks.forEach((week, index) => {
    const x = left + (right - left) * index / Math.max(1, chart.weeks.length - 1);
    context.fillStyle = "#667893";
    context.fillText(week.label.replace(" de ", " "), x, height - 7);
  });
  chart.series.filter((item) => !selectedClass || item.id === selectedClass).forEach((series) => {
    const color = colors[chart.series.indexOf(series) % colors.length];
    context.strokeStyle = color; context.lineWidth = 2;
    let drawing = false;
    context.beginPath();
    series.points.forEach((point, index) => {
      if (point.value === null) { drawing = false; return; }
      const x = left + (right - left) * index / Math.max(1, chart.weeks.length - 1);
      const y = bottom - (bottom - top) * point.value / 100;
      if (drawing) context.lineTo(x, y); else context.moveTo(x, y);
      drawing = true;
    });
    context.stroke();
    series.points.forEach((point, index) => {
      if (point.value === null) return;
      const x = left + (right - left) * index / Math.max(1, chart.weeks.length - 1);
      const y = bottom - (bottom - top) * point.value / 100;
      context.fillStyle = color;
      context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill();
    });
  });
};
