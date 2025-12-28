/* Route Guard – Access Contract */

(function () {
  const path = location.pathname;
  const loggedIn = sessionStorage.getItem("loggedIn") === "true";
  const role = sessionStorage.getItem("role"); // set by policy router only

  // Public access
  if (
    path.endsWith("/login.html") ||
    path.endsWith("/checker.html") ||
    path.endsWith("/error-404.html") ||
    path.endsWith("/error-offline.html")
  ) return;

  // Offline → hard fail
  if (!navigator.onLine) {
    location.replace("/public/error-offline.html");
    return;
  }

  // No session → block
  if (!loggedIn) {
    location.replace("/public/error-404.html");
    return;
  }

  // Role-based scope enforcement
  const scopeRules = [
    { scope: "/portals/student/", role: "student" },
    { scope: "/portals/teacher/", role: "teacher" },
    { scope: "/portals/hod/", role: "hod" },
    { scope: "/admin/", role: "admin" }
  ];

  for (const rule of scopeRules) {
    if (path.includes(rule.scope) && role !== rule.role) {
      location.replace("/public/error-404.html");
      return;
    }
  }
})();
