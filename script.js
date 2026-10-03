/* ===== CONFIG =====
   If the page is opened from the FastAPI server (http://127.0.0.1:2200) we use relative URLs.
   If you open index.html directly (file://) or from another server, we call the API on port 2200. */
const API_BASE = (location.protocol.startsWith("http") && location.port === "2200") ? "" : "http://127.0.0.1:2200";
const API_URL = API_BASE + "/predict";
const HEALTH_URL = API_BASE + "/health";

const COUNTRIES = ["India","USA","Canada","Australia","UK","Germany","Mexico","Turkey","France",
  "Brazil","China","Japan","South Korea","Russia","Italy","Spain","Netherlands","Sweden","Norway",
  "Denmark","Switzerland","Pakistan","Bangladesh","Nepal","Sri Lanka","Indonesia","Philippines",
  "Vietnam","Thailand","Malaysia","Singapore","UAE","Saudi Arabia","Egypt","Nigeria","South Africa",
  "Kenya","Argentina","Chile","Colombia","Poland","Ukraine","Ireland","New Zealand","Other"];

/* ===== populate country ===== */
const countrySel = document.getElementById("country");
COUNTRIES.forEach(c => countrySel.add(new Option(c, c)));
countrySel.value = "India";

/* ===== sliders ===== */
document.querySelectorAll('input[type=range]').forEach(r => {
  const out = document.querySelector(`[data-out="${r.id}"]`);
  const update = () => {
    out.textContent = r.value;
    r.style.setProperty("--fill", (r.value / r.max * 100) + "%");
  };
  r.addEventListener("input", update); update();
});

/* ===== chips ===== */
document.querySelectorAll(".chips").forEach(group => {
  group.addEventListener("click", e => {
    const chip = e.target.closest(".chip"); if (!chip) return;
    group.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
  });
});
const chipVal = name => document.querySelector(`.chips[data-name="${name}"] .chip.active`).dataset.value;

/* ===== submit ===== */
const form = document.getElementById("form");
const btn = document.getElementById("submitBtn");
const errBox = document.getElementById("error");
const $ = id => document.getElementById(id);

form.addEventListener("submit", async e => {
  e.preventDefault();
  errBox.classList.remove("show");

  const payload = {
    Age: parseInt($("age").value),
    gender: chipVal("gender"),
    country: $("country").value,
    academic_level: $("academic_level").value,
    most_used_platform: $("most_used_platform").value,
    purpose_of_use: $("purpose_of_use").value,
    avg_daily_usage_hours: parseFloat($("avg_daily_usage_hours").value),
    daily_unlocks: parseInt($("daily_unlocks").value),
    study_hours: parseFloat($("study_hours").value),
    physical_activity_hours: parseFloat($("physical_activity_hours").value),
    sleep_hours_per_night: parseFloat($("sleep_hours_per_night").value),
    stress_level: chipVal("stress_level"),
  };

  if (!(payload.Age >= 10 && payload.Age <= 100)) return showError("Age must be between 10 and 100.");
  if (isNaN(payload.daily_unlocks) || payload.daily_unlocks < 0) return showError("Enter a valid number of daily unlocks.");

  btn.classList.add("loading"); btn.disabled = true;
  try {
    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (netErr) {
      setApi(false);
      throw new Error("Can't reach the API at " + API_URL + ". Start it with:  uvicorn main:app --port 2200 --reload  (run inside the project folder).");
    }

    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch {}

    if (!res.ok) throw new Error(describeError(res, json, raw));
    if (!json || typeof json.predicted_mental_health_score !== "number")
      throw new Error("API replied, but without a prediction. Response: " + raw.slice(0, 200));

    setApi(true);
    showResult(json.predicted_mental_health_score, payload);
    if (window.innerWidth <= 900) $("result").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showError(err.message);
  } finally {
    btn.classList.remove("loading"); btn.disabled = false;
  }
});

function describeError(res, json, raw){
  if (json && Array.isArray(json.detail))            // FastAPI validation error (422)
    return "Invalid input → " + json.detail.map(d => (d.loc || []).slice(1).join(".") + ": " + d.msg).join(" | ");
  if (json && json.detail)
    return typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
  return `Unexpected reply (${res.status} ${res.statusText}) from ${API_URL}. ` +
         "This is not the FastAPI app — another program may be using that port. " + raw.slice(0, 120);
}

/* ===== API status badge ===== */
function setApi(ok){
  $("apiBadge").className = "badge " + (ok ? "on" : "off");
  $("apiText").textContent = ok ? "API online · ML model ready" : "API offline";
}
async function pingApi(){
  try { const r = await fetch(HEALTH_URL); setApi(r.ok); } catch { setApi(false); }
}
pingApi(); setInterval(pingApi, 15000);

function showError(msg){ errBox.textContent = msg; errBox.classList.add("show"); }

/* ===== result ===== */
const CIRC = 2 * Math.PI * 86;
function showResult(score, p){
  const pct = Math.max(0, Math.min(score / 10, 1));
  $("bar").style.strokeDashoffset = CIRC * (1 - pct);

  // count-up
  const el = $("score"); const t0 = performance.now();
  (function tick(t){
    const k = Math.min((t - t0) / 1200, 1);
    el.textContent = (score * (1 - Math.pow(1 - k, 3))).toFixed(2);
    if (k < 1) requestAnimationFrame(tick);
  })(t0);

  const v = $("verdict");
  v.className = "verdict " + (score >= 7 ? "ok" : score >= 5.5 ? "warn" : "bad");
  v.textContent = score >= 7 ? "😊 Healthy balance" : score >= 5.5 ? "😐 Moderate — room to improve" : "😟 Needs attention";

  const tips = [];
  if (p.sleep_hours_per_night < 7) tips.push("😴 Aim for 7–9 hours of sleep — it's the biggest lever on mood.");
  if (p.avg_daily_usage_hours > 5) tips.push("📵 Try cutting social media time with app timers or screen-free hours.");
  if (p.daily_unlocks > 100) tips.push("🔓 Lots of phone unlocks — turn off non-essential notifications.");
  if (p.physical_activity_hours < 0.5) tips.push("🏃 Even a 20–30 min daily walk noticeably helps.");
  if (["High","Very High"].includes(p.stress_level)) tips.push("🧘 High stress — breathing exercises, breaks, or talking to someone you trust can help.");
  if (!tips.length) tips.push("✅ Your habits look balanced — keep it up!");
  $("tips").innerHTML = tips.map((t,i) => `<li style="animation-delay:${i*.12}s">${t}</li>`).join("");
}

/* ===== floating particles background ===== */
(function(){
  const cv = $("bg"), ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, dpr, parts = [], mouse = { x: -9999, y: -9999 };
  const COLORS = ["230,25,45", "255,70,85", "140,0,15"];

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
    const n = Math.min(Math.floor(innerWidth * innerHeight / 14000), 110);
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .35 * dpr, vy: (Math.random() - .5) * .35 * dpr - .08 * dpr,
      r: (Math.random() * 1.8 + .6) * dpr,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      a: Math.random() * .5 + .25,
    }));
  }
  addEventListener("resize", resize); resize();
  addEventListener("pointermove", e => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
  addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

  function frame(){
    ctx.clearRect(0, 0, W, H);
    const link = 120 * dpr;
    for (let i = 0; i < parts.length; i++){
      const p = parts[i];
      if (!reduce){
        p.x += p.vx; p.y += p.vy;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 140 * dpr){ p.x += dx / d * 1.2; p.y += dy / d * 1.2; }
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fillStyle = `rgba(${p.c},${p.a})`; ctx.shadowBlur = 10 * dpr; ctx.shadowColor = `rgba(${p.c},.8)`;
      ctx.fill(); ctx.shadowBlur = 0;
      for (let j = i + 1; j < parts.length; j++){
        const q = parts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < link){
          ctx.strokeStyle = `rgba(${p.c},${(1 - d / link) * .16})`; ctx.lineWidth = dpr * .8;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }
    requestAnimationFrame(frame);
  }
  frame();
})();
