export class Router {
  constructor() {
    this.routes = [];
  }
  get(path, handler) {
    this.routes.push({ method: "GET", path, handler });
  }
  post(path, handler) {
    this.routes.push({ method: "POST", path, handler });
  }
  patch(path, handler) {
    this.routes.push({ method: "PATCH", path, handler });
  }
  delete(path, handler) {
    this.routes.push({ method: "DELETE", path, handler });
  }
  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = matchPath(route.path, pathname);
      if (params !== null) return { handler: route.handler, params };
    }
    return null;
  }
}

function matchPath(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}
