(() => {
  "use strict";
  const A = window.AF;
  A.renderAdminLogin = () => {
    clearInterval(A.countdown);
    A.app.innerHTML = `${A.header('<button class="btn btn-outline btn-small" data-route="login">客户入口</button>')}<main class="center-page"><section class="card login-card"><h1>管理员登录</h1><p>使用管理员邮箱和密码</p><form id="adminLogin" class="form"><div class="field"><label>邮箱</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>密码</label><input name="password" type="password" autocomplete="current-password" required></div><div id="adminError" class="error"></div><button class="btn btn-primary btn-block" type="submit">登录</button></form></section></main>`;
    document.getElementById("adminLogin").onsubmit = async event => {
      event.preventDefault(); const form=event.currentTarget,button=form.querySelector("button"),err=document.getElementById("adminError"),v=new FormData(form); button.disabled=true;err.textContent="";
      const {error}=await A.sb.auth.signInWithPassword({email:String(v.get("email")).trim(),password:String(v.get("password"))});
      if(error){err.textContent="邮箱或密码不正确";button.disabled=false;return;} location.hash="#admin";
    };
  };

  A.renderSetup = setupToken => {
    clearInterval(A.countdown);
    A.app.innerHTML = `${A.header()}<main class="center-page"><section class="card login-card"><h1>创建管理员</h1><p>该初始化链接仅可使用一次</p><form id="setupForm" class="form"><div class="field"><label>显示名称</label><input name="displayName" value="平台管理员" maxlength="40" required></div><div class="field"><label>管理员邮箱</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>密码</label><input name="password" type="password" minlength="12" autocomplete="new-password" required></div><div class="field"><label>确认密码</label><input name="confirmPassword" type="password" minlength="12" autocomplete="new-password" required></div><div id="setupError" class="error"></div><button class="btn btn-primary btn-block" type="submit" ${setupToken?"":"disabled"}>创建管理员</button></form></section></main>`;
    document.getElementById("setupForm").onsubmit = async event => {
      event.preventDefault(); const form=event.currentTarget,button=form.querySelector("button"),err=document.getElementById("setupError"),v=new FormData(form),password=String(v.get("password"));
      if(password!==String(v.get("confirmPassword"))){err.textContent="两次输入的密码不一致";return;} button.disabled=true;err.textContent="";
      try { await A.call("admin-bootstrap",{setupToken,displayName:v.get("displayName"),email:v.get("email"),password}); A.toast("管理员创建成功"); history.replaceState(null,"",`${location.pathname}#admin-login`); A.renderAdminLogin(); }
      catch(error){err.textContent=error.message;button.disabled=false;}
    };
  };
})();
