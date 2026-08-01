(() => {
  "use strict";
  const A = window.AF = {};
  A.URL = "https://hhnojifcrfjaxineofzb.supabase.co";
  A.KEY = "sb_publishable_C3h2bILFy_MeZkAkTGcEzg_AwLTJ9bx";
  A.CUSTOMER_KEY = "accessflow_customer_token";
  A.FUNCTIONS = `${A.URL}/functions/v1`;
  A.app = document.getElementById("app");
  A.modal = document.getElementById("modalRoot");
  A.toastNode = document.getElementById("toast");
  A.sb = window.supabase.createClient(A.URL, A.KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  A.portalOrder = null;
  A.countdown = null;
  A.toastTimer = null;
  A.statusText = { waiting: "待开始", active: "使用中", paused: "已暂停", expired: "已到期", ended: "已结束" };
  A.assistText = { idle: "未申请", requested: "等待处理", processing: "处理中", ready: "已完成", closed: "已关闭" };

  A.header = extra => `<header class="header"><div class="brand"><div class="logo">AF</div><strong>AccessFlow</strong></div><div class="actions">${extra || ""}</div></header>`;
  A.loading = () => { clearInterval(A.countdown); A.app.innerHTML = `${A.header()}<div class="loading">加载中…</div>`; };
  A.escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  A.toast = message => { A.toastNode.textContent = message; A.toastNode.classList.add("show"); clearTimeout(A.toastTimer); A.toastTimer = setTimeout(() => A.toastNode.classList.remove("show"), 2400); };
  A.errorText = code => ({
    invalid_credentials_format:"订单号或访问码格式不正确", invalid_credentials:"订单号或访问码不正确",
    too_many_attempts:"尝试次数过多，请稍后再试", order_unavailable:"该订单当前不可使用",
    invalid_session:"登录已失效，请重新登录", missing_session:"请先登录", browser_not_ready:"使用环境尚未准备完成",
    invalid_email:"邮箱格式不正确", password_too_short:"密码至少需要 12 位", bootstrap_expired:"初始化链接已过期",
    bootstrap_already_used:"管理员已完成初始化", invalid_setup_token:"初始化链接无效", email_already_exists:"该邮箱已存在",
    not_admin:"当前账号没有管理员权限", invalid_auth:"管理员登录已失效", assistance_not_ready:"请先完成登录处理",
    invalid_order_state:"当前订单状态不支持该操作", no_requested_assistance:"没有待处理的登录请求"
  })[code] || "操作失败，请稍后重试";

  A.call = async (name, body, token = "") => {
    const response = await fetch(`${A.FUNCTIONS}/${name}`, {
      method: "POST",
      headers: { "Content-Type":"application/json", apikey:A.KEY, ...(token ? {Authorization:`Bearer ${token}`} : {}) },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(A.errorText(data.error)); error.code = data.error; error.payload = data; throw error; }
    return data;
  };
  A.customerToken = () => sessionStorage.getItem(A.CUSTOMER_KEY) || "";
  A.routeInfo = () => { const [path, query=""] = (location.hash || "#login").slice(1).split("?"); return {path, params:new URLSearchParams(query)}; };
  A.statusBadge = status => { const cls = status === "active" ? "badge-success" : ["waiting","paused"].includes(status) ? "badge-warning" : ["expired","ended"].includes(status) ? "badge-danger" : "badge-neutral"; return `<span class="badge ${cls}">${A.escape(A.statusText[status] || status)}</span>`; };
  A.remainingText = order => {
    if (order.status === "waiting") return "尚未开始";
    if (order.status === "paused") return "已暂停";
    if (["expired","ended"].includes(order.status)) return "00:00:00";
    if (!order.expiresAt) return "—";
    const total = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000));
    const d = Math.floor(total/86400), h = Math.floor(total%86400/3600), m = Math.floor(total%3600/60), s = total%60;
    const clock = [h,m,s].map(v => String(v).padStart(2,"0")).join(":");
    return d ? `${d}天 ${clock}` : clock;
  };
  A.formatDate = value => new Intl.DateTimeFormat("zh-CN", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  A.closeModal = () => { A.modal.innerHTML = ""; };
  A.showCredentials = (orderCode, accessCode, title) => {
    const orderRow = orderCode ? `<div class="credential-row"><span>订单号</span><code>${A.escape(orderCode)}</code></div>` : "";
    const copyText = orderCode ? `订单号：${orderCode}\n访问码：${accessCode}` : `新访问码：${accessCode}`;
    A.modal.innerHTML = `<div class="modal-backdrop"><section class="card modal"><div class="modal-head"><div><h2>${A.escape(title)}</h2><p>请立即复制并发送给客户</p></div><button class="close" data-close>×</button></div><div class="credential-box">${orderRow}<div class="credential-row"><span>访问码</span><code>${A.escape(accessCode)}</code></div></div><p class="notice">访�.码不会再次显示；丢失后只能重置。</p><button id="copyCredentials" class="btn btn-primary btn-block">复制</button></section></div>`;
    A.modal.querySelector("[data-close]").onclick = () => { A.closeModal(); A.renderAdmin?.(); };
    document.getElementById("copyCredentials").onclick = async () => { await navigator.clipboard.writeText(copyText); A.toast("已复制"); };
  };
})();
