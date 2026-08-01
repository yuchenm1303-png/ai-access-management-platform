(() => {
  "use strict";
  const A = window.AF;
  A.route = async () => {
    A.loading(); A.closeModal(); const {path,params}=A.routeInfo();
    if(path==="setup")return A.renderSetup(params.get("token")||"");
    if(path==="portal")return A.renderPortal();
    if(path==="admin-login")return A.renderAdminLogin();
    if(path==="admin")return A.renderAdmin();
    return A.renderLogin();
  };
  document.addEventListener("click",event=>{const t=event.target.closest("[data-route]");if(t)location.hash=`#${t.dataset.route}`;});
  window.addEventListener("hashchange",A.route);
  window.addEventListener("storage",event=>{if(event.key?.startsWith("sb-")&&A.routeInfo().path==="admin")A.route();});
  A.route();
})();
