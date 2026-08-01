(() => {
  "use strict";

  const STORAGE_KEY = "accessflow-minimal-state";
  const CUSTOMER_KEY = "accessflow-customer-session";
  const ADMIN_KEY = "accessflow-admin-session";

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  const toastNode = document.getElementById("toast");

  let state = loadState();
  let toastTimer = null;

  function seedState() {
    const now = Date.now();
    return {
      orders: [
        {
          id: "AF-20260731-001",
          accessCode: "246810",
          customer: "演示客户",
          plan: "24 小时",
          durationHours: 24,
          status: "active",
          assistStatus: "ready",
          createdAt: now - 2 * 60 * 60 * 1000,
          startedAt: now - 60 * 60 * 1000,
          expiresAt: now + 23 * 60 * 60 * 1000,
          pausedRemaining: null,
          sessionId: "BR-1001"
        },
        {
          id: "AF-20260731-002",
          accessCode: "135790",
          customer: "等待协助客户",
          plan: "7 天",
          durationHours: 168,
          status: "waiting",
          assistStatus: "waiting",
          createdAt: now - 36 * 60 * 1000,
          startedAt: null,
          expiresAt: null,
          pausedRemaining: null,
          sessionId: "BR-1002"
        }
      ]
    };
  }

  function loadState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (value && Array.isArray(value.orders)) return value;
    } catch (error) {
      console.warn("读取本地数据失败", error);
    }
    const initial = seedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeOrders() {
    let changed = false;
    const now = Date.now();
    state.orders.forEach(order => {
      if (order.status === "active" && order.expiresAt && order.expiresAt <= now) {
        order.status = "ended";
        order.assistStatus = "ended";
        changed = true;
      }
    });
    if (changed) saveState();
    return changed;
  }

  function customerSession() {
    return sessionStorage.getItem(CUSTOMER_KEY);
  }

  function adminSession() {
    return sessionStorage.getItem(ADMIN_KEY) === "1";
  }

  function header(right = "") {
    return `
      <header class="header">
        <div class="container header-row">
          <button class="brand text-btn" data-route="#login" aria-label="返回首页">
            <span class="logo">AF</span><span>AccessFlow</span>
          </button>
          <div class="header-actions">${right}</div>
        </div>
      </header>`;
  }

  function renderLogin() {
    app.innerHTML = `
      ${header('<button class="text-btn" data-route="#admin-login">管理员</button>')}
      <main class="login-main">
        <section class="card login-card">
          <h1>进入使用中心</h1>
          <p>输入订单号和访问码</p>
          <form id="customerLogin" class="form" novalidate>
            <div class="field">
              <label for="orderId">订单号</label>
              <input id="orderId" name="orderId" autocomplete="off" placeholder="AF-20260731-001" required>
            </div>
            <div class="field">
              <label for="accessCode">6 位访问码</label>
              <input id="accessCode" name="accessCode" class="code-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" required>
            </div>
            <div id="loginError" class="form-error"></div>
            <button class="btn btn-primary btn-block" type="submit">进入</button>
          </form>
          <div class="login-foot">
            <button id="fillDemo" class="text-btn" type="button">填入演示账号</button>
          </div>
        </section>
      </main>`;

    document.getElementById("customerLogin").addEventListener("submit", event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const id = String(form.get("orderId") || "").trim().toUpperCase();
      const code = String(form.get("accessCode") || "").trim();
      const order = state.orders.find(item => item.id.toUpperCase() === id && item.accessCode === code);
      if (!order) {
        document.getElementById("loginError").textContent = "订单号或访问码不正确";
        return;
      }
      if (order.status === "ended") {
        document.getElementById("loginError").textContent = "该订单已结束";
        return;
      }
      sessionStorage.setItem(CUSTOMER_KEY, order.id);
      location.hash = "#portal";
    });

    document.getElementById("fillDemo").addEventListener("click", () => {
      document.getElementById("orderId").value = "AF-20260731-001";
      document.getElementById("accessCode").value = "246810";
    });
  }

  function renderPortal() {
    const id = customerSession();
    const order = state.orders.find(item => item.id === id);
    if (!order || order.status === "ended") {
      sessionStorage.removeItem(CUSTOMER_KEY);
      location.hash = "#login";
      return;
    }

    const canRequest = order.assistStatus === "none";
    const canEnter = order.status === "active" && order.assistStatus === "ready";
    const assistText = assistLabel(order.assistStatus);

    app.innerHTML = `
      ${header('<button id="customerLogout" class="text-btn">退出</button>')}
      <main class="page">
        <div class="container">
          <div class="page-head">
            <div><h1>${escapeHtml(order.customer)}</h1><p>${escapeHtml(order.id)}</p></div>
          </div>
          <div class="portal-grid">
            <section class="card access-card">
              <div class="access-top">
                <div><h2>${escapeHtml(order.plan)}</h2><p>${statusLabel(order.status)}</p></div>
                <span class="status status-${statusClass(order.status)}">${statusLabel(order.status)}</span>
              </div>
              <div class="time-label">剩余时间</div>
              <div id="remainingTime" class="time-value">${remainingText(order)}</div>
              <div class="actions">
                <button id="requestAssist" class="btn btn-outline" ${canRequest ? "" : "disabled"}>${assistButtonText(order.assistStatus)}</button>
                <button id="enterSession" class="btn btn-primary" ${canEnter ? "" : "disabled"}>进入使用</button>
                <button id="requestRenew" class="btn btn-soft">申请续费</button>
              </div>
            </section>
            <section class="card status-card">
              <h3>订单信息</h3>
              <div class="info-row"><span>登录协助</span><b>${assistText}</b></div>
              <div class="info-row"><span>到期时间</span><b>${order.expiresAt ? formatDate(order.expiresAt) : "尚未开始"}</b></div>
              <div class="info-row"><span>会话编号</span><b>${escapeHtml(order.sessionId || "待分配")}</b></div>
            </section>
          </div>
        </div>
      </main>`;

    document.getElementById("customerLogout").addEventListener("click", () => {
      sessionStorage.removeItem(CUSTOMER_KEY);
      location.hash = "#login";
    });

    document.getElementById("requestAssist").addEventListener("click", () => {
      order.assistStatus = "waiting";
      if (order.status !== "active" && order.status !== "paused") order.status = "waiting";
      saveState();
      toast("已提交登录协助");
      renderPortal();
    });

    document.getElementById("enterSession").addEventListener("click", () => {
      openModal(`
        <div class="modal-head">
          <div><h2>进入使用</h2><p>${escapeHtml(order.sessionId)}</p></div>
          <button class="close-btn" data-close>×</button>
        </div>
        <p style="color:var(--muted);font-size:11px;margin:0">受控浏览器接口将在后端版本中接入。</p>
        <div class="modal-actions"><button class="btn btn-primary" data-close>关闭</button></div>`);
    });

    document.getElementById("requestRenew").addEventListener("click", () => toast("续费申请已记录"));
  }

  function renderAdminLogin() {
    app.innerHTML = `
      ${header('<button class="text-btn" data-route="#login">客户入口</button>')}
      <main class="login-main">
        <section class="card login-card">
          <h1>管理员登录</h1>
          <p>进入订单管理</p>
          <form id="adminLogin" class="form" novalidate>
            <div class="field">
              <label for="adminName">账号</label>
              <input id="adminName" name="username" autocomplete="username" required>
            </div>
            <div class="field">
              <label for="adminPassword">密码</label>
              <input id="adminPassword" name="password" type="password" autocomplete="current-password" required>
            </div>
            <div id="adminError" class="form-error"></div>
            <button class="btn btn-primary btn-block" type="submit">登录</button>
          </form>
          <div class="login-foot"><button id="fillAdmin" class="text-btn" type="button">填入演示账号</button></div>
        </section>
      </main>`;

    document.getElementById("adminLogin").addEventListener("submit", event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      if (form.get("username") !== "admin" || form.get("password") !== "demo1234") {
        document.getElementById("adminError").textContent = "账号或密码不正确";
        return;
      }
      sessionStorage.setItem(ADMIN_KEY, "1");
      location.hash = "#admin";
    });

    document.getElementById("fillAdmin").addEventListener("click", () => {
      document.getElementById("adminName").value = "admin";
      document.getElementById("adminPassword").value = "demo1234";
    });
  }

  function renderAdmin() {
    if (!adminSession()) {
      location.hash = "#admin-login";
      return;
    }

    const active = state.orders.filter(order => order.status === "active").length;
    const waiting = state.orders.filter(order => order.assistStatus === "waiting" || order.assistStatus === "processing").length;
    const ended = state.orders.filter(order => order.status === "ended").length;

    app.innerHTML = `
      ${header(`
        <button id="newOrder" class="btn btn-primary btn-small">新建订单</button>
        <button id="adminLogout" class="text-btn">退出</button>`)}
      <main class="page">
        <div class="container">
          <div class="page-head"><div><h1>订单管理</h1><p>客户、访问码和登录状态</p></div></div>
          <div class="admin-summary">
            <span class="summary-chip">使用中 <b>${active}</b></span>
            <span class="summary-chip">待处理 <b>${waiting}</b></span>
            <span class="summary-chip">已结束 <b>${ended}</b></span>
          </div>
          <section class="card table-card">
            ${ordersTable()}
          </section>
        </div>
      </main>`;

    document.getElementById("newOrder").addEventListener("click", openNewOrderModal);
    document.getElementById("adminLogout").addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_KEY);
      location.hash = "#admin-login";
    });

    app.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", () => adminAction(button.dataset.action, button.dataset.id));
    });
  }

  function ordersTable() {
    if (!state.orders.length) return '<div class="empty">暂无订单</div>';
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>订单</th><th>访问码</th><th>状态</th><th>登录协助</th><th>到期</th><th>操作</th></tr></thead>
          <tbody>${state.orders.map(orderRow).join("")}</tbody>
        </table>
      </div>`;
  }

  function orderRow(order) {
    return `
      <tr>
        <td><div class="order-main"><b>${escapeHtml(order.customer)}</b><small>${escapeHtml(order.id)} · ${escapeHtml(order.plan)}</small></div></td>
        <td><span class="code">${escapeHtml(order.accessCode)}</span></td>
        <td><span class="status status-${statusClass(order.status)}">${statusLabel(order.status)}</span></td>
        <td>${assistLabel(order.assistStatus)}</td>
        <td>${order.expiresAt ? formatDate(order.expiresAt) : "—"}</td>
        <td><div class="row-actions">${adminButtons(order)}</div></td>
      </tr>`;
  }

  function adminButtons(order) {
    const buttons = [];
    if (order.assistStatus === "waiting") buttons.push(actionButton("处理", "process", order.id, "btn-warning"));
    if (order.assistStatus === "processing") buttons.push(actionButton("完成登录", "complete", order.id, "btn-success"));
    if (order.status === "active") {
      buttons.push(actionButton("暂停", "pause", order.id, "btn-outline"));
      buttons.push(actionButton("+1天", "extend", order.id, "btn-soft"));
    }
    if (order.status === "paused") buttons.push(actionButton("恢复", "resume", order.id, "btn-success"));
    if (order.status !== "ended") buttons.push(actionButton("结束", "end", order.id, "btn-danger"));
    return buttons.join("") || "—";
  }

  function actionButton(label, action, id, className) {
    return `<button class="btn btn-small ${className}" data-action="${action}" data-id="${escapeAttr(id)}">${label}</button>`;
  }

  function adminAction(action, id) {
    const order = state.orders.find(item => item.id === id);
    if (!order) return;

    if (action === "process") {
      order.assistStatus = "processing";
      toast("已开始处理登录");
    }
    if (action === "complete") {
      order.assistStatus = "ready";
      order.status = "active";
      order.startedAt = order.startedAt || Date.now();
      order.expiresAt = Date.now() + order.durationHours * 60 * 60 * 1000;
      order.pausedRemaining = null;
      toast("登录完成，租期已开始");
    }
    if (action === "pause" && order.status === "active") {
      order.pausedRemaining = Math.max(0, order.expiresAt - Date.now());
      order.expiresAt = null;
      order.status = "paused";
      toast("订单已暂停");
    }
    if (action === "resume" && order.status === "paused") {
      order.expiresAt = Date.now() + (order.pausedRemaining || order.durationHours * 60 * 60 * 1000);
      order.pausedRemaining = null;
      order.status = "active";
      toast("订单已恢复");
    }
    if (action === "extend") {
      order.expiresAt = (order.expiresAt || Date.now()) + 24 * 60 * 60 * 1000;
      toast("已延长 1 天");
    }
    if (action === "end") {
      if (!confirm(`结束订单 ${order.id}？`)) return;
      order.status = "ended";
      order.assistStatus = "ended";
      order.expiresAt = Date.now();
      toast("订单已结束");
    }
    saveState();
    renderAdmin();
  }

  function openNewOrderModal() {
    openModal(`
      <div class="modal-head">
        <div><h2>新建订单</h2><p>生成订单号和访问码</p></div>
        <button class="close-btn" data-close>×</button>
      </div>
      <form id="newOrderForm" class="form">
        <div class="field"><label for="customerName">客户名称</label><input id="customerName" name="customer" required></div>
        <div class="field">
          <label for="plan">套餐</label>
          <select id="plan" name="plan">
            <option value="24">24 小时</option>
            <option value="168">7 天</option>
            <option value="720">30 天</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" data-close>取消</button>
          <button class="btn btn-primary" type="submit">创建</button>
        </div>
      </form>`);

    document.getElementById("newOrderForm").addEventListener("submit", event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const durationHours = Number(form.get("plan"));
      const planMap = { 24: "24 小时", 168: "7 天", 720: "30 天" };
      const order = {
        id: createOrderId(),
        accessCode: String(Math.floor(100000 + Math.random() * 900000)),
        customer: String(form.get("customer") || "客户").trim(),
        plan: planMap[durationHours] || `${durationHours} 小时`,
        durationHours,
        status: "waiting",
        assistStatus: "none",
        createdAt: Date.now(),
        startedAt: null,
        expiresAt: null,
        pausedRemaining: null,
        sessionId: `BR-${Math.floor(1000 + Math.random() * 9000)}`
      };
      state.orders.unshift(order);
      saveState();
      closeModal();
      renderAdmin();
      openModal(`
        <div class="modal-head"><div><h2>订单已创建</h2><p>${escapeHtml(order.customer)}</p></div><button class="close-btn" data-close>×</button></div>
        <div class="info-row"><span>订单号</span><b class="code">${escapeHtml(order.id)}</b></div>
        <div class="info-row"><span>访问码</span><b class="code">${escapeHtml(order.accessCode)}</b></div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>完成</button></div>`);
    });
  }

  function openModal(content) {
    modalRoot.innerHTML = `<div class="modal-backdrop"><section class="card modal">${content}</section></div>`;
    modalRoot.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
    modalRoot.querySelector(".modal-backdrop").addEventListener("click", event => {
      if (event.target.classList.contains("modal-backdrop")) closeModal();
    });
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function createOrderId() {
    const date = new Date();
    const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const serial = String(state.orders.filter(order => order.id.includes(day)).length + 1).padStart(3, "0");
    return `AF-${day}-${serial}`;
  }

  function statusLabel(status) {
    return ({ waiting: "待登录", active: "使用中", paused: "已暂停", ended: "已结束" })[status] || "待处理";
  }

  function statusClass(status) {
    return ({ waiting: "waiting", active: "active", paused: "paused", ended: "ended" })[status] || "waiting";
  }

  function assistLabel(status) {
    return ({ none: "未申请", waiting: "等待处理", processing: "处理中", ready: "已完成", ended: "已结束" })[status] || "未申请";
  }

  function assistButtonText(status) {
    return ({ none: "申请登录协助", waiting: "等待管理员", processing: "管理员处理中", ready: "登录已完成", ended: "已结束" })[status] || "申请登录协助";
  }

  function remainingText(order) {
    if (order.status === "paused") return formatDuration(order.pausedRemaining || 0);
    if (order.status !== "active" || !order.expiresAt) return "尚未开始";
    return formatDuration(Math.max(0, order.expiresAt - Date.now()));
  }

  function formatDuration(ms) {
    if (ms <= 0) return "00:00:00";
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days} 天 ${hours} 小时`;
    return `${String(hours).padStart(2, "0")} 小时 ${String(minutes).padStart(2, "0")} 分`;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    }).format(new Date(value));
  }

  function toast(message) {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2200);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function route() {
    normalizeOrders();
    closeModal();
    const hash = location.hash || "#login";
    if (hash === "#portal") return renderPortal();
    if (hash === "#admin-login") return renderAdminLogin();
    if (hash === "#admin") return renderAdmin();
    renderLogin();
  }

  document.addEventListener("click", event => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) location.hash = routeButton.dataset.route;
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      route();
    }
  });

  setInterval(() => {
    const changed = normalizeOrders();
    if (changed) route();
    const order = state.orders.find(item => item.id === customerSession());
    const remaining = document.getElementById("remainingTime");
    if (order && remaining) remaining.textContent = remainingText(order);
  }, 1000);

  route();
})();
