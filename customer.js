(() => {
  "use strict";
  const A = window.AF;
  A.renderLogin = () => {
    clearInterval(A.countdown);
    A.app.innerHTML = `${A.header('<button class="btn btn-outline btn-small" data-route="admin-login">管理员</button>')}<main class="center-page"><section class="card login-card"><h1>进入使用中心</h1><p>请输入订单号和访问码</p><form id="customerLogin" class="form"><div class="field"><label>订单号</label><input name="orderCode" autocomplete="off" placeholder="AF-20260801-XXXX" required></div><div class="field"><label>6 位访问码</label><input name="accessCode" class="code-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></div><div id="loginError" class="error"></div><button class="btn btn-primary btn-block" type="submit">登录</button></form></section></main>`;
    document.getElementById("customerLogin").onsubmit = async event => {
      event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button"), err = document.getElementById("loginError");
      button.disabled = true; err.textContent = "";
      try { const values = new FormData(form); const result = await A.call("customer-access", {action:"login",orderCode:values.get("orderCode"),accessCode:values.get("accessCode")}); sessionStorage.setItem(A.CUSTOMER_KEY,result.token); A.portalOrder=result.order; location.hash="#portal"; }
      catch (error) { err.textContent = error.message; }
      finally { button.disabled = false; }
    };
  };

  A.renderPortal = async () => {
    const token = A.customerToken(); if (!token) { location.hash="#login"; return; }
    try { A.portalOrder = (await A.call("customer-access", {action:"status"}, token)).order; }
    catch (error) {
      if (["invalid_session","missing_session"].includes(error.code)) { sessionStorage.removeItem(A.CUSTOMER_KEY); location.hash="#login"; return; }
      A.app.innerHTML = `${A.header()}<main class="center-page"><section class="card login-card"><h1>加载失败</h1><p>${A.escape(error.message)}</p><button class="btn btn-outline btn-block" data-route="login">返回</button></section></main>`; return;
    }
    const o = A.portalOrder;
    A.app.innerHTML = `${A.header('<button id="customerLogout" class="btn btn-outline btn-small">退出</button>')}<main class="page"><section class="card portal-card"><div class="portal-top"><div><h1>${A.escape(o.customerName)}</h1><p>${A.escape(o.orderCode)}</p></div>${A.statusBadge(o.status)}</div><div class="remaining"><small>剩余时间</small><strong id="remainingTime">${A.remainingText(o)}</strong></div><div class="info-list"><div class="info-item"><span>套餐</span><b>${A.escape(o.planName)}</b></div><div class="info-item"><span>登录状态</span><b>${A.escape(A.assistText[o.assistStatus] || o.assistStatus)}</b></div><div class="info-item"><span>续费申请</span><b>${o.renewalRequested?"已提交":"未提交"}</b></div></div><div class="actions"><button id="assistButton" class="btn btn-soft" ${["requested","processing","ready","closed"].includes(o.assistStatus)?"disabled":""}>申请登录协助</button><button id="enterButton" class="btn btn-primary" ${o.browserReady?"":"disabled"}>进入使用</button><button id="renewButton" class="btn btn-outline" ${o.renewalRequested?"disabled":""}>申请续费</button></div></section></main>`;
    document.getElementById("customerLogout").onclick = async () => { try { await A.call("customer-access",{action:"logout"},token); } catch(_){} sessionStorage.removeItem(A.CUSTOMER_KEY); location.hash="#login"; };
    document.getElementById("assistButton").onclick = () => A.customerAction("request_assistance");
    document.getElementById("renewButton").onclick = () => A.customerAction("request_renewal");
    document.getElementById("enterButton").onclick = () => A.customerAction("enter");
    clearInterval(A.countdown); A.countdown=setInterval(()=>{const n=document.getElementById("remainingTime");if(n&&A.portalOrder)n.textContent=A.remainingText(A.portalOrder);},1000);
  };

  A.customerAction = async action => {
    try { const result=await A.call("customer-access",{action},A.customerToken()); if(result.order)A.portalOrder=result.order; A.toast(action==="request_assistance"?"登录协助已提交":action==="request_renewal"?"续费申请已提交":"远程浏览器服务尚未完成接入"); A.renderPortal(); }
    catch(error){ A.toast(error.code==="browser_not_ready"?"使用环境尚未准备完成":error.message); }
  };
})();
