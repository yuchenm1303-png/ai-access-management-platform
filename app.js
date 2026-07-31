(() => {
      "use strict";

      const STORAGE_KEY = "accessflow-v2-state";
      const SESSION_KEY = "accessflow-v2-session";
      const ADMIN_SESSION_KEY = "accessflow-v2-admin-session";

      const now = Date.now();
      const demoOrders = [
        {
          id: "AF-20260731-001",
          accessCode: "246810",
          customer: "演示客户",
          contact: "微信客户 A",
          plan: "24 小时体验",
          durationHours: 24,
          status: "active",
          assistStatus: "ready",
          createdAt: now - 2 * 60 * 60 * 1000,
          startedAt: now - 60 * 60 * 1000,
          expiresAt: now + 23 * 60 * 60 * 1000,
          sessionId: "BR-1001",
          notes: "演示订单"
        },
        {
          id: "AF-20260731-002",
          accessCode: "135790",
          customer: "等待协助客户",
          contact: "微信客户 B",
          plan: "7 天套餐",
          durationHours: 168,
          status: "waiting",
          assistStatus: "waiting",
          createdAt: now - 35 * 60 * 1000,
          startedAt: null,
          expiresAt: null,
          sessionId: "BR-1002",
          notes: "客户已申请登录协助"
        }
      ];

      const defaultState = {
        orders: demoOrders,
        logs: [
          { id: cryptoId(), at: now - 8 * 60 * 1000, text: "演示客户进入客户中心" },
          { id: cryptoId(), at: now - 31 * 60 * 1000, text: "等待协助客户提交登录协助请求" }
        ]
      };

      let state = loadState();
      let timer = null;

      function cryptoId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      }

      function loadState() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (saved && Array.isArray(saved.orders) && Array.isArray(saved.logs)) return saved;
        } catch (error) {
          console.warn("无法读取本地演示数据", error);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
        return structuredClone(defaultState);
      }

      function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }

      function resetDemo() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(ADMIN_SESSION_KEY);
        state = structuredClone(defaultState);
        saveState();
        route();
        toast("演示数据已恢复");
      }

      function formatDate(timestamp) {
        if (!timestamp) return "尚未开始";
        return new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
        }).format(new Date(timestamp));
      }

      function formatFullDate(timestamp) {
        if (!timestamp) return "尚未开始";
        return new Intl.DateTimeFormat("zh-CN", {
          year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
        }).format(new Date(timestamp));
      }

      function remaining(timestamp) {
        if (!timestamp) return { days: "--", hours: "--", minutes: "--", seconds: "--", expired: false };
        const diff = Math.max(0, timestamp - Date.now());
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return {
          days: String(days).padStart(2, "0"),
          hours: String(hours).padStart(2, "0"),
          minutes: String(minutes).padStart(2, "0"),
          seconds: String(seconds).padStart(2, "0"),
          expired: timestamp <= Date.now()
        };
      }

      function addLog(text) {
        state.logs.unshift({ id: cryptoId(), at: Date.now(), text });
        state.logs = state.logs.slice(0, 30);
        saveState();
      }

      function findOrder(id) {
        return state.orders.find(order => order.id === id);
      }

      function getCustomerOrder() {
        const orderId = sessionStorage.getItem(SESSION_KEY);
        return orderId ? findOrder(orderId) : null;
      }

      function statusInfo(order) {
        if (!order) return { label: "未知", className: "status-ended" };
        if (order.status === "ended" || (order.expiresAt && order.expiresAt <= Date.now())) {
          return { label: "使用已结束", className: "status-ended" };
        }
        if (order.status === "paused") return { label: "使用已暂停", className: "status-waiting" };
        if (order.assistStatus === "waiting") return { label: "等待管理员处理", className: "status-waiting" };
        if (order.assistStatus === "processing") return { label: "管理员正在登录", className: "status-processing" };
        if (order.assistStatus === "ready" && order.status === "active") return { label: "已准备好，可以进入", className: "status-ready" };
        return { label: "等待登录协助", className: "status-waiting" };
      }

      function badgeInfo(order) {
        if (order.status === "ended" || (order.expiresAt && order.expiresAt <= Date.now())) return ["已结束", "badge-ended"];
        if (order.status === "paused") return ["已暂停", "badge-paused"];
        if (order.assistStatus === "processing") return ["处理中", "badge-processing"];
        if (order.assistStatus === "waiting") return ["待登录", "badge-waiting"];
        if (order.status === "active") return ["使用中", "badge-active"];
        return ["待处理", "badge-waiting"];
      }

      function route() {
        clearInterval(timer);
        const hash = location.hash || "#customer";
        if (hash.startsWith("#admin")) {
          if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") renderAdmin();
          else renderAdminLogin();
          return;
        }
        const order = getCustomerOrder();
        if (hash === "#portal" && order) renderCustomerPortal(order);
        else renderCustomerLogin();
      }

      function renderPublicHeader(extra = "") {
        return `
          <header class="public-header">
            <div class="container" style="display:flex;align-items:center;justify-content:space-between;gap:14px">
              <div class="brand">
                <div class="brand-mark">AF</div>
                <div><strong>AccessFlow</strong><small>客户访问中心</small></div>
              </div>
              <div class="header-actions">${extra}</div>
            </div>
          </header>`;
      }

      function renderCustomerLogin() {
        document.title = "AccessFlow · 客户登录";
        document.getElementById("app").innerHTML = `
          ${renderPublicHeader('<button class="btn btn-outline btn-small" id="helpBtn">使用说明</button>')}
          <main class="container login-layout">
            <section class="intro">
              <span class="intro-badge">受控访问服务正常</span>
              <h1>用订单号进入<br><span>你的专属使用空间</span></h1>
              <p>客户无需接触共享账号密码。输入订单号和 6 位访问码，即可查看登录进度、剩余时间，并在管理员完成登录后进入受控浏览器。</p>
              <div class="feature-list">
                <article class="feature"><div class="feature-icon">01</div><b>订单独立</b><small>每位客户只看到自己的订单、租期和会话状态。</small></article>
                <article class="feature"><div class="feature-icon">02</div><b>登录协助</b><small>客户发起请求后，由管理员在后台完成登录与验证。</small></article>
                <article class="feature"><div class="feature-icon">03</div><b>到期停用</b><small>使用结束后访问码和浏览器入口同时失效。</small></article>
              </div>
            </section>
            <section class="card login-card">
              <h2>客户登录</h2>
              <p>请输入管理员发给你的订单信息。</p>
              <form id="customerLoginForm" class="form" novalidate>
                <div class="field">
                  <label for="orderId">订单号</label>
                  <input id="orderId" autocomplete="off" placeholder="例如 AF-20260731-001" required />
                </div>
                <div class="field">
                  <label for="accessCode">6 位访问码</label>
                  <input id="accessCode" class="code-input" autocomplete="one-time-code" inputmode="numeric" maxlength="6" placeholder="••••••" required />
                </div>
                <div id="loginError" class="error"></div>
                <button class="btn btn-primary btn-block" type="submit">进入使用中心</button>
              </form>
              <div class="demo-box">
                <b>演示账号</b>（仅用于查看原型）
                <div class="demo-line"><span>订单号</span><code>AF-20260731-001</code></div>
                <div class="demo-line"><span>访问码</span><code>246810</code></div>
                <button class="btn btn-soft btn-small" id="fillDemo" style="margin-top:10px">自动填入</button>
              </div>
            </section>
          </main>
          <div class="container footer-link">遇到问题请联系管理员 · <button id="adminEntry">管理员入口</button></div>`;

        document.getElementById("fillDemo").onclick = () => {
          document.getElementById("orderId").value = "AF-20260731-001";
          document.getElementById("accessCode").value = "246810";
        };
        document.getElementById("adminEntry").onclick = () => { location.hash = "#admin"; };
        document.getElementById("helpBtn").onclick = () => openInfoModal("客户使用流程", `
          <div class="progress-list">
            ${progressItem("1", "输入订单号和访问码", "进入自己的客户使用中心。", "done")}
            ${progressItem("2", "申请登录协助", "管理员后台会收到待处理任务。", "current")}
            ${progressItem("3", "等待管理员完成登录", "密码和第三方验证码不会展示给客户。", "")}
            ${progressItem("4", "进入受控浏览器", "租期开始后可在有效时间内使用。", "")}
          </div>`);
        document.getElementById("customerLoginForm").onsubmit = event => {
          event.preventDefault();
          const id = document.getElementById("orderId").value.trim().toUpperCase();
          const code = document.getElementById("accessCode").value.trim();
          const order = state.orders.find(item => item.id === id && item.accessCode === code);
          const error = document.getElementById("loginError");
          if (!order) {
            error.textContent = "订单号或访问码不正确，请核对后重试。";
            return;
          }
          if (order.status === "ended" || (order.expiresAt && order.expiresAt <= Date.now())) {
            error.textContent = "该订单已经结束，请联系管理员续费。";
            return;
          }
          sessionStorage.setItem(SESSION_KEY, order.id);
          addLog(`${order.customer} 登录客户使用中心`);
          location.hash = "#portal";
        };
      }

      function progressItem(number, title, text, stateClass) {
        return `<div class="progress-item ${stateClass}"><div class="progress-dot">${stateClass === "done" ? "✓" : number}</div><div><b>${title}</b><small>${text}</small></div></div>`;
      }

      function renderCustomerPortal(order) {
        document.title = "AccessFlow · 客户使用中心";
        normalizeExpired(order);
        const status = statusInfo(order);
        const clock = remaining(order.expiresAt);
        const canEnter = order.status === "active" && order.assistStatus === "ready" && !clock.expired;
        const canRequest = !["waiting", "processing", "ready"].includes(order.assistStatus) && order.status !== "ended";
        const doneRequest = order.assistStatus !== "not_requested";
        const doneProcessing = ["processing", "ready"].includes(order.assistStatus);
        const doneReady = order.assistStatus === "ready";

        document.getElementById("app").innerHTML = `
          <div class="customer-app">
            ${renderPublicHeader('<button class="btn btn-outline btn-small" id="customerLogout">退出</button>')}
            <main class="container customer-main">
              <div class="welcome-row">
                <div><h1>你好，${escapeHtml(order.customer)}</h1><p>订单 ${order.id} · ${escapeHtml(order.plan)}</p></div>
                <span class="status-pill ${status.className}">${status.label}</span>
              </div>

              <section class="customer-grid">
                <article class="access-hero">
                  <div class="eyebrow">剩余使用时间</div>
                  <h2>${order.status === "paused" ? "当前租期已暂停" : canEnter ? "你的专属浏览器已准备好" : "等待登录协助完成"}</h2>
                  <p>${canEnter ? "点击“进入使用”打开受控浏览器。" : "管理员完成登录后，入口会自动变为可用。"}</p>
                  <div class="countdown" id="countdown">
                    <div><b>${clock.days}</b><small>天</small></div>
                    <div><b>${clock.hours}</b><small>小时</small></div>
                    <div><b>${clock.minutes}</b><small>分钟</small></div>
                    <div><b>${clock.seconds}</b><small>秒</small></div>
                  </div>
                  <div class="hero-actions">
                    <button id="enterSession" class="btn btn-primary" ${canEnter ? "" : "disabled"}>进入使用</button>
                    <button id="requestAssist" class="btn btn-outline" ${canRequest ? "" : "disabled"}>${order.assistStatus === "waiting" ? "已提交协助请求" : order.assistStatus === "processing" ? "管理员正在处理" : order.assistStatus === "ready" ? "登录已完成" : "申请登录协助"}</button>
                    <button id="renewRequest" class="btn btn-outline">申请续费</button>
                  </div>
                </article>

                <article class="card status-card">
                  <h3>登录进度</h3>
                  <p>客户不需要接触账号密码或第三方验证码。</p>
                  <span class="status-pill ${status.className}">${status.label}</span>
                  <div class="progress-list">
                    ${progressItem("1", "订单验证通过", "访问码已验证，客户身份已确认。", "done")}
                    ${progressItem("2", "提交登录协助", doneRequest ? "管理员已经收到你的请求。" : "点击左侧按钮提交请求。", doneRequest ? "done" : "current")}
                    ${progressItem("3", "管理员完成登录", doneProcessing ? (doneReady ? "登录与验证已完成。" : "管理员正在受控浏览器中操作。") : "请等待管理员处理。", doneReady ? "done" : doneProcessing ? "current" : "")}
                    ${progressItem("4", "进入专属会话", canEnter ? "入口已经开放。" : "完成登录后自动开放。", canEnter ? "done" : "")}
                  </div>
                </article>
              </section>

              <section class="detail-grid">
                <article class="card info-card">
                  <h3>订单信息</h3>
                  <div class="info-row"><span>客户名称</span><b>${escapeHtml(order.customer)}</b></div>
                  <div class="info-row"><span>套餐</span><b>${escapeHtml(order.plan)}</b></div>
                  <div class="info-row"><span>开始时间</span><b>${formatFullDate(order.startedAt)}</b></div>
                  <div class="info-row"><span>到期时间</span><b>${formatFullDate(order.expiresAt)}</b></div>
                  <div class="info-row"><span>会话编号</span><b>${order.sessionId || "待分配"}</b></div>
                </article>
                <article class="card info-card">
                  <h3>使用说明</h3>
                  <div class="info-row"><span>登录方式</span><b>订单号 + 访问码</b></div>
                  <div class="info-row"><span>第三方登录</span><b>由管理员完成</b></div>
                  <div class="info-row"><span>到期处理</span><b>自动关闭入口</b></div>
                  <div class="info-row"><span>续费方式</span><b>提交申请后联系管理员</b></div>
                  <div class="notice">请勿在客户页面提交第三方账号密码、验证码、Cookie 或会话令牌。本原型只管理订单访问权限和登录协助状态。</div>
                </article>
              </section>
            </main>
          </div>`;

        document.getElementById("customerLogout").onclick = () => {
          sessionStorage.removeItem(SESSION_KEY);
          location.hash = "#customer";
        };
        document.getElementById("requestAssist").onclick = () => {
          order.assistStatus = "waiting";
          if (order.status !== "active") order.status = "waiting";
          addLog(`${order.customer} 提交登录协助请求`);
          saveState();
          renderCustomerPortal(order);
          toast("协助请求已提交，管理员后台已收到任务");
        };
        document.getElementById("renewRequest").onclick = () => {
          addLog(`${order.customer} 提交续费申请`);
          toast("续费申请已记录，请联系管理员确认套餐");
        };
        document.getElementById("enterSession").onclick = () => openRemoteModal(order, false);

        timer = setInterval(() => {
          const current = remaining(order.expiresAt);
          const target = document.getElementById("countdown");
          if (!target) return;
          target.innerHTML = `<div><b>${current.days}</b><small>天</small></div><div><b>${current.hours}</b><small>小时</small></div><div><b>${current.minutes}</b><small>分钟</small></div><div><b>${current.seconds}</b><small>秒</small></div>`;
          if (current.expired) {
            order.status = "ended";
            saveState();
            clearInterval(timer);
            renderCustomerPortal(order);
          }
        }, 1000);
      }

      function renderAdminLogin() {
        document.title = "AccessFlow · 管理员登录";
        document.getElementById("app").innerHTML = `
          ${renderPublicHeader('<button class="btn btn-outline btn-small" id="backCustomer">返回客户入口</button>')}
          <main class="container login-layout" style="grid-template-columns:1fr 440px">
            <section class="intro">
              <span class="intro-badge">管理员专用入口</span>
              <h1>处理客户订单、<br><span>登录协助与租期</span></h1>
              <p>管理员后台不会向客户展示收入统计。这里只处理客户身份、订单访问码、登录协助任务、浏览器会话和到期停用。</p>
            </section>
            <section class="card login-card">
              <h2>管理员登录</h2>
              <p>当前为静态原型，账号仅用于演示角色隔离。</p>
              <form id="adminLoginForm" class="form" novalidate>
                <div class="field"><label for="adminUser">管理员账号</label><input id="adminUser" autocomplete="username" placeholder="admin" /></div>
                <div class="field"><label for="adminPass">管理员密码</label><input id="adminPass" type="password" autocomplete="current-password" placeholder="请输入演示密码" /></div>
                <div id="adminError" class="error"></div>
                <button class="btn btn-primary btn-block" type="submit">进入管理后台</button>
              </form>
              <div class="demo-box"><b>原型演示凭据</b><div class="demo-line"><span>账号</span><code>admin</code></div><div class="demo-line"><span>密码</span><code>demo1234</code></div><div style="margin-top:8px">正式版本必须改为服务端鉴权和加密密码，不能把管理员密码写在前端。</div></div>
            </section>
          </main>`;
        document.getElementById("backCustomer").onclick = () => { location.hash = "#customer"; };
        document.getElementById("adminLoginForm").onsubmit = event => {
          event.preventDefault();
          const user = document.getElementById("adminUser").value.trim();
          const pass = document.getElementById("adminPass").value;
          if (user !== "admin" || pass !== "demo1234") {
            document.getElementById("adminError").textContent = "管理员账号或密码错误。";
            return;
          }
          sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
          addLog("管理员登录后台");
          renderAdmin();
        };
      }

      function renderAdmin(activePage = "dashboard") {
        document.title = "AccessFlow · 管理后台";
        normalizeAllExpired();
        const pending = state.orders.filter(order => ["waiting", "processing"].includes(order.assistStatus) && order.status !== "ended").length;
        const active = state.orders.filter(order => order.status === "active" && (!order.expiresAt || order.expiresAt > Date.now())).length;
        const expiring = state.orders.filter(order => order.expiresAt && order.expiresAt > Date.now() && order.expiresAt - Date.now() <= 24 * 3600000).length;

        document.getElementById("app").innerHTML = `
          <div class="admin-shell">
            <aside class="sidebar" id="sidebar">
              <div class="brand"><div class="brand-mark">AF</div><div><strong>AccessFlow</strong><small>管理员后台</small></div></div>
              <div class="nav-label">管理中心</div>
              <nav class="nav">
                <button data-admin-page="dashboard">管理总览</button>
                <button data-admin-page="orders">订单与访问码</button>
                <button data-admin-page="sessions">浏览器会话</button>
                <button data-admin-page="logs">操作日志</button>
              </nav>
              <div class="nav-label">入口</div>
              <nav class="nav"><button id="openCustomerEntry">打开客户入口</button></nav>
              <div class="admin-user"><small>当前管理员</small><b>平台管理员 · 在线</b><button class="btn btn-outline btn-small" id="adminLogout" style="margin-top:10px;width:100%">退出后台</button></div>
            </aside>
            <main>
              <header class="admin-header">
                <div style="display:flex;align-items:center;gap:10px"><button class="btn btn-outline btn-small mobile-menu" id="mobileMenu">☰</button><div><h1 id="adminTitle">管理总览</h1><p id="adminSubtitle">处理客户订单、登录协助和租期</p></div></div>
                <button class="btn btn-primary btn-small" id="newOrderTop">新增订单</button>
              </header>
              <div class="admin-content">
                ${renderAdminDashboard(pending, active, expiring)}
                ${renderOrdersPage()}
                ${renderSessionsPage()}
                ${renderLogsPage()}
              </div>
            </main>
          </div>`;

        bindAdminNavigation(activePage);
        document.getElementById("newOrderTop").onclick = openNewOrderModal;
        document.getElementById("adminLogout").onclick = () => {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          addLog("管理员退出后台");
          renderAdminLogin();
        };
        document.getElementById("openCustomerEntry").onclick = () => { location.hash = "#customer"; };
        const mobile = document.getElementById("mobileMenu");
        if (mobile) mobile.onclick = () => document.getElementById("sidebar").classList.toggle("open");
        bindAdminActions();
      }

      function renderAdminDashboard(pending, active, expiring) {
        const tasks = state.orders.filter(order => ["waiting", "processing"].includes(order.assistStatus) && order.status !== "ended");
        return `
          <section class="admin-page" id="admin-dashboard">
            <div class="admin-hero">
              <article class="admin-hero-main">
                <span class="intro-badge" style="color:white;background:rgba(255,255,255,.12)">● 客户访问服务正常</span>
                <h2>把客户登录、访问码和到期停用集中到一个后台。</h2>
                <p>客户只看到自己的登录进度和剩余时间；管理员在这里创建订单、处理登录协助、开放会话和结束租期。</p>
                <button class="btn btn-outline" id="newOrderHero" style="margin-top:10px">新增客户订单</button>
              </article>
              <article class="card system-card">
                <h3>系统状态</h3><p>当前为静态交互原型</p>
                <div class="system-row"><span><i class="system-dot"></i>客户入口</span><b>正常</b></div>
                <div class="system-row"><span><i class="system-dot"></i>订单权限</span><b>本地演示</b></div>
                <div class="system-row"><span><i class="system-dot"></i>会话服务</span><b>界面占位</b></div>
                <div class="system-row"><span><i class="system-dot"></i>敏感凭据存储</span><b>未启用</b></div>
              </article>
            </div>
            <div class="metrics">
              <article class="card metric"><span>待处理登录</span><b>${pending}</b></article>
              <article class="card metric"><span>正在使用</span><b>${active}</b></article>
              <article class="card metric"><span>24 小时内到期</span><b>${expiring}</b></article>
              <article class="card metric"><span>客户订单总数</span><b>${state.orders.length}</b></article>
            </div>
            <div class="admin-grid">
              <article class="card">
                <div class="panel-head"><div><h3>待处理登录协助</h3><p>客户提交后在此处理</p></div></div>
                <div class="panel-body"><div class="task-list">${tasks.length ? tasks.map(renderTask).join("") : '<div class="notice">目前没有待处理任务。</div>'}</div></div>
              </article>
              <article class="card">
                <div class="panel-head"><div><h3>最近操作</h3><p>最多显示 6 条</p></div></div>
                <div class="panel-body"><div class="log-list">${state.logs.slice(0,6).map(renderLog).join("")}</div></div>
              </article>
            </div>
          </section>`;
      }

      function renderTask(order) {
        return `<div class="task"><div><b>${escapeHtml(order.customer)} · ${order.id}</b><small>${order.assistStatus === "processing" ? "管理员正在处理" : "等待管理员接管登录"}</small></div><div class="action-row">${order.assistStatus === "waiting" ? `<button class="btn btn-soft btn-small" data-action="takeover" data-id="${order.id}">接管登录</button>` : `<button class="btn btn-success btn-small" data-action="finish-login" data-id="${order.id}">标记完成</button>`}</div></div>`;
      }

      function renderOrdersPage() {
        return `
          <section class="admin-page" id="admin-orders">
            <div class="toolbar"><div><h2>订单与访问码</h2><p>创建客户访问凭据，并管理租期状态。</p></div><div class="toolbar-actions"><input id="orderSearch" class="search" placeholder="搜索订单号、客户或联系方式" /><button class="btn btn-primary" id="newOrderPage">新增订单</button></div></div>
            <article class="card"><div class="panel-body table-wrap" style="padding-top:6px"><table><thead><tr><th>客户</th><th>订单号</th><th>访问码</th><th>套餐</th><th>登录状态</th><th>到期时间</th><th>操作</th></tr></thead><tbody id="ordersBody">${state.orders.map(renderOrderRow).join("")}</tbody></table></div></article>
          </section>`;
      }

      function renderOrderRow(order) {
        const [label, badgeClass] = badgeInfo(order);
        return `<tr data-search-row="${escapeAttr(`${order.id} ${order.customer} ${order.contact}`.toLowerCase())}"><td><div class="table-user"><div class="avatar">${escapeHtml(order.customer.slice(0,1))}</div><div><b>${escapeHtml(order.customer)}</b><small>${escapeHtml(order.contact)}</small></div></div></td><td><b>${order.id}</b></td><td><code>${order.accessCode}</code> <button class="btn btn-soft btn-small" data-action="copy-code" data-id="${order.id}">复制</button></td><td>${escapeHtml(order.plan)}</td><td><span class="badge ${badgeClass}">${label}</span></td><td>${formatDate(order.expiresAt)}</td><td><div class="action-row"><button class="btn btn-soft btn-small" data-action="open-order" data-id="${order.id}">详情</button><button class="btn btn-outline btn-small" data-action="extend" data-id="${order.id}">+24h</button><button class="btn btn-danger btn-small" data-action="end" data-id="${order.id}">结束</button></div></td></tr>`;
      }

      function renderSessionsPage() {
        return `<section class="admin-page" id="admin-sessions"><div class="toolbar"><div><h2>浏览器会话</h2><p>每个订单对应独立的受控浏览器会话。</p></div></div><div class="session-grid">${state.orders.map(renderSessionCard).join("")}</div></section>`;
      }

      function renderSessionCard(order) {
        const [label, badgeClass] = badgeInfo(order);
        return `<article class="card session-card"><div class="session-top"><div class="browser-icon">WEB</div><span class="badge ${badgeClass}">${label}</span></div><h3>${order.sessionId || "待分配会话"}</h3><p>${escapeHtml(order.customer)} · ${order.id}</p><div class="meta"><div><span>登录协助</span><b>${assistLabel(order.assistStatus)}</b></div><div><span>开始时间</span><b>${formatDate(order.startedAt)}</b></div><div><span>到期时间</span><b>${formatDate(order.expiresAt)}</b></div></div><div class="session-actions"><button class="btn btn-soft btn-small" data-action="takeover" data-id="${order.id}">管理员接管</button>${order.status === "paused" ? `<button class="btn btn-success btn-small" data-action="resume" data-id="${order.id}">恢复</button>` : `<button class="btn btn-outline btn-small" data-action="pause" data-id="${order.id}">暂停</button>`}<button class="btn btn-danger btn-small" data-action="end" data-id="${order.id}">销毁</button></div></article>`;
      }

      function renderLogsPage() {
        return `<section class="admin-page" id="admin-logs"><div class="toolbar"><div><h2>操作日志</h2><p>记录客户与管理员在原型中的关键操作。</p></div><button class="btn btn-outline" id="resetDemo">恢复演示数据</button></div><article class="card"><div class="panel-body" style="padding-top:18px"><div class="log-list">${state.logs.map(renderLog).join("")}</div></div></article></section>`;
      }

      function renderLog(log) {
        return `<div class="log-item"><b>${escapeHtml(log.text)}</b><small>${formatFullDate(log.at)}</small></div>`;
      }

      function assistLabel(status) {
        return ({ not_requested: "未申请", waiting: "等待处理", processing: "处理中", ready: "已完成" })[status] || "未申请";
      }

      function bindAdminNavigation(activePage) {
        const titles = {
          dashboard: ["管理总览", "处理客户订单、登录协助和租期"],
          orders: ["订单与访问码", "创建客户访问凭据并管理租期"],
          sessions: ["浏览器会话", "处理登录接管、暂停和销毁"],
          logs: ["操作日志", "查看客户与管理员的关键操作"]
        };
        function show(page) {
          document.querySelectorAll(".admin-page").forEach(section => section.classList.toggle("active", section.id === `admin-${page}`));
          document.querySelectorAll("[data-admin-page]").forEach(button => button.classList.toggle("active", button.dataset.adminPage === page));
          document.getElementById("adminTitle").textContent = titles[page][0];
          document.getElementById("adminSubtitle").textContent = titles[page][1];
          document.getElementById("sidebar").classList.remove("open");
        }
        document.querySelectorAll("[data-admin-page]").forEach(button => button.onclick = () => show(button.dataset.adminPage));
        show(activePage);
      }

      function bindAdminActions() {
        const hero = document.getElementById("newOrderHero");
        const page = document.getElementById("newOrderPage");
        if (hero) hero.onclick = openNewOrderModal;
        if (page) page.onclick = openNewOrderModal;
        const search = document.getElementById("orderSearch");
        if (search) search.oninput = () => {
          const query = search.value.trim().toLowerCase();
          document.querySelectorAll("[data-search-row]").forEach(row => row.classList.toggle("hidden", !row.dataset.searchRow.includes(query)));
        };
        const reset = document.getElementById("resetDemo");
        if (reset) reset.onclick = resetDemo;
        document.querySelectorAll("[data-action]").forEach(button => button.onclick = () => handleAdminAction(button.dataset.action, button.dataset.id));
      }

      function handleAdminAction(action, id) {
        const order = findOrder(id);
        if (!order) return;
        if (action === "copy-code") {
          navigator.clipboard?.writeText(order.accessCode).then(() => toast("访问码已复制")).catch(() => toast(`访问码：${order.accessCode}`));
          return;
        }
        if (action === "open-order") {
          openOrderModal(order);
          return;
        }
        if (action === "takeover") {
          order.assistStatus = "processing";
          if (!order.sessionId) order.sessionId = `BR-${Math.floor(1000 + Math.random() * 9000)}`;
          addLog(`管理员开始处理 ${order.customer} 的登录协助`);
          saveState();
          openRemoteModal(order, true);
          return;
        }
        if (action === "finish-login") {
          finishLogin(order);
          return;
        }
        if (action === "extend") {
          const base = Math.max(Date.now(), order.expiresAt || Date.now());
          order.expiresAt = base + 24 * 3600000;
          if (!order.startedAt) order.startedAt = Date.now();
          order.status = "active";
          addLog(`${order.customer} 的订单延长 24 小时`);
        }
        if (action === "pause") {
          order.status = "paused";
          addLog(`管理员暂停 ${order.customer} 的会话`);
        }
        if (action === "resume") {
          order.status = order.assistStatus === "ready" ? "active" : "waiting";
          addLog(`管理员恢复 ${order.customer} 的会话`);
        }
        if (action === "end") {
          if (!confirm(`确认结束 ${order.customer} 的订单并关闭客户入口吗？`)) return;
          order.status = "ended";
          order.assistStatus = "not_requested";
          order.expiresAt = Date.now();
          addLog(`管理员结束 ${order.customer} 的订单`);
        }
        saveState();
        renderAdmin(action === "end" || action === "extend" ? "orders" : "sessions");
        toast("操作已保存");
      }

      function finishLogin(order) {
        order.assistStatus = "ready";
        order.status = "active";
        if (!order.startedAt) order.startedAt = Date.now();
        if (!order.expiresAt || order.expiresAt <= Date.now()) order.expiresAt = order.startedAt + order.durationHours * 3600000;
        if (!order.sessionId) order.sessionId = `BR-${Math.floor(1000 + Math.random() * 9000)}`;
        addLog(`管理员完成 ${order.customer} 的登录并开放会话`);
        saveState();
        closeModal();
        renderAdmin("dashboard");
        toast("登录已标记完成，客户入口已开放");
      }

      function openNewOrderModal() {
        openModal("新增客户订单", "生成订单号和 6 位访问码。", `
          <form id="newOrderForm" class="modal-form">
            <div class="field"><label>客户名称</label><input id="newCustomer" required placeholder="例如 张先生" /></div>
            <div class="field"><label>联系方式备注</label><input id="newContact" required placeholder="例如 微信昵称" /></div>
            <div class="field"><label>套餐</label><select id="newPlan"><option value="1|1 小时体验">1 小时体验</option><option value="24|24 小时套餐" selected>24 小时套餐</option><option value="168|7 天套餐">7 天套餐</option><option value="720|30 天套餐">30 天套餐</option></select></div>
            <div class="field"><label>初始状态</label><select id="newStatus"><option value="not_requested">等待客户申请协助</option><option value="waiting">直接创建待登录任务</option></select></div>
            <div class="field field-full"><label>备注</label><input id="newNotes" placeholder="可选" /></div>
          </form>
          <div class="security-note">访问码用于登录本平台客户中心，不是第三方服务验证码。正式版本应由服务端生成、加密保存并支持失效与重置。</div>`, [
            { label: "取消", className: "btn-outline", onClick: closeModal },
            { label: "创建订单", className: "btn-primary", onClick: createOrder }
          ]);
      }

      function createOrder() {
        const customer = document.getElementById("newCustomer").value.trim();
        const contact = document.getElementById("newContact").value.trim();
        if (!customer || !contact) { toast("请填写客户名称和联系方式备注"); return; }
        const [hours, plan] = document.getElementById("newPlan").value.split("|");
        const assistStatus = document.getElementById("newStatus").value;
        const date = new Date();
        const day = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
        const serial = String(state.orders.length + 1).padStart(3, "0");
        const id = `AF-${day}-${serial}`;
        const accessCode = String(Math.floor(100000 + Math.random() * 900000));
        state.orders.unshift({
          id, accessCode, customer, contact, plan, durationHours: Number(hours),
          status: assistStatus === "waiting" ? "waiting" : "pending",
          assistStatus, createdAt: Date.now(), startedAt: null, expiresAt: null,
          sessionId: `BR-${Math.floor(1000 + Math.random() * 9000)}`,
          notes: document.getElementById("newNotes").value.trim()
        });
        addLog(`管理员为 ${customer} 创建订单 ${id}`);
        saveState();
        closeModal();
        renderAdmin("orders");
        openInfoModal("订单创建成功", `<div class="info-row"><span>订单号</span><b>${id}</b></div><div class="info-row"><span>访问码</span><b style="letter-spacing:.18em">${accessCode}</b></div><div class="notice">请将订单号和访问码单独发送给客户。该访问码只用于客户登录本平台。</div>`);
      }

      function openOrderModal(order) {
        const [label, badgeClass] = badgeInfo(order);
        openModal(`订单 ${order.id}`, `${escapeHtml(order.customer)} · ${escapeHtml(order.contact)}`, `
          <div class="info-row"><span>客户状态</span><span class="badge ${badgeClass}">${label}</span></div>
          <div class="info-row"><span>平台访问码</span><b style="letter-spacing:.18em">${order.accessCode}</b></div>
          <div class="info-row"><span>套餐</span><b>${escapeHtml(order.plan)}</b></div>
          <div class="info-row"><span>登录协助</span><b>${assistLabel(order.assistStatus)}</b></div>
          <div class="info-row"><span>会话编号</span><b>${order.sessionId || "待分配"}</b></div>
          <div class="info-row"><span>开始时间</span><b>${formatFullDate(order.startedAt)}</b></div>
          <div class="info-row"><span>到期时间</span><b>${formatFullDate(order.expiresAt)}</b></div>
          <div class="notice">第三方账号密码和验证码不应保存在订单数据中。登录操作应只在管理员受控浏览器内临时完成。</div>`, [
            { label: "关闭", className: "btn-outline", onClick: closeModal },
            { label: "管理员接管登录", className: "btn-primary", onClick: () => { closeModal(); handleAdminAction("takeover", order.id); } }
          ]);
      }

      function openRemoteModal(order, isAdmin) {
        const ready = order.assistStatus === "ready" && order.status === "active";
        const title = isAdmin ? `管理员登录接管 · ${order.id}` : `专属浏览器 · ${order.id}`;
        const text = isAdmin
          ? "在真实版本中，这里会连接该订单的独立云浏览器。管理员在浏览器内完成第三方登录和验证码验证。"
          : "这里将连接你的独立云浏览器会话。当前静态原型仅展示入口和状态。";
        openModal(title, `${escapeHtml(order.customer)} · ${order.sessionId || "待分配"}`, `
          <div class="remote-preview">
            <div class="remote-bar">受控浏览器 · ${order.sessionId || "待分配"} · ${isAdmin ? "管理员控制中" : "客户控制中"}</div>
            <div class="remote-screen"><div><div class="browser-icon" style="margin:0 auto 14px">WEB</div><h3>${isAdmin ? "登录接管界面占位" : ready ? "客户使用界面占位" : "会话尚未开放"}</h3><p>${text}</p></div></div>
          </div>
          <div class="security-note">本原型不采集、不显示也不保存第三方密码、验证码、Cookie 或会话令牌。正式实现时应让敏感输入只发生在隔离浏览器内。</div>`, isAdmin ? [
            { label: "稍后处理", className: "btn-outline", onClick: closeModal },
            { label: "标记登录完成并开始计时", className: "btn-primary", onClick: () => finishLogin(order) }
          ] : [{ label: "关闭", className: "btn-primary", onClick: closeModal }]);
      }

      function openInfoModal(title, content) {
        openModal(title, "", content, [{ label: "我知道了", className: "btn-primary", onClick: closeModal }]);
      }

      function openModal(title, subtitle, content, buttons = []) {
        document.getElementById("modalRoot").innerHTML = `
          <div class="modal-backdrop open" id="modalBackdrop">
            <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
              <div class="modal-head"><div><h3 id="modalTitle">${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="modal-close" id="modalClose" aria-label="关闭">×</button></div>
              <div class="modal-body"><div>${content}</div><div class="modal-footer" id="modalFooter"></div></div>
            </section>
          </div>`;
        document.getElementById("modalClose").onclick = closeModal;
        document.getElementById("modalBackdrop").onclick = event => { if (event.target.id === "modalBackdrop") closeModal(); };
        const footer = document.getElementById("modalFooter");
        buttons.forEach(config => {
          const button = document.createElement("button");
          button.className = `btn ${config.className || "btn-outline"}`;
          button.textContent = config.label;
          button.onclick = config.onClick;
          footer.appendChild(button);
        });
      }

      function closeModal() {
        document.getElementById("modalRoot").innerHTML = "";
      }

      function normalizeExpired(order) {
        if (order.expiresAt && order.expiresAt <= Date.now() && order.status !== "ended") {
          order.status = "ended";
          order.assistStatus = "not_requested";
          saveState();
        }
      }

      function normalizeAllExpired() {
        state.orders.forEach(normalizeExpired);
      }

      function toast(message) {
        const target = document.getElementById("toast");
        target.textContent = message;
        target.classList.add("show");
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => target.classList.remove("show"), 2600);
      }

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
      }

      function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#96;");
      }

      window.addEventListener("hashchange", route);
      window.addEventListener("storage", event => {
        if (event.key === STORAGE_KEY) {
          state = loadState();
          route();
        }
      });
      route();
    })();
