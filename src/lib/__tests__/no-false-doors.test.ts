/**
 * Gate de PORTA FALSA — link interno tem que apontar pra rota que existe.
 *
 * Motivo (medido em origin/staging 9c92413): src/app/premium/checkout/page.tsx
 * linkava "Li e aceito os termos de uso" pra /landing/termos e a politica pra
 * /landing/privacidade. Nenhuma das duas existe neste app — src/app/landing/
 * so tem page.tsx. Consentimento de pagamento com os dois links em 404.
 *
 * O gate varre TODO href/router.push literal de src/app + src/components e
 * exige que o destino case com uma rota real (page.tsx) deste app OU com uma
 * rota do shell na allowlist abaixo (a raiz do dominio nao passa pelo basePath
 * /relacionamentos, entao <a href="/termos"> chega no shell).
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = process.cwd();
const APP_DIR = join(ROOT, "src", "app");

/**
 * Rotas servidas pelo openticket-shell na RAIZ do dominio, fora do basePath
 * deste app. Conferidas em openticket-shell origin/staging:
 *   - src/app/termos/page.tsx       (LegalDocument + content/legal/terms)
 *   - src/app/privacidade/page.tsx  (LegalDocument + content/legal/privacy)
 * Só entra aqui link que sai com <a> puro (next/link prefixaria o basePath).
 */
const SHELL_ROOT_ROUTES = ["/termos", "/privacidade"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** src/app/(public)/(relacionamentos)/hub/page.tsx -> /hub */
function routeFromPagePath(file: string): string {
  const rel = relative(APP_DIR, file).split(sep).slice(0, -1);
  const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segments.join("/");
}

function routeToRegExp(route: string): RegExp {
  const body = route
    .split("/")
    .filter(Boolean)
    .map((seg) =>
      seg.startsWith("[") && seg.endsWith("]") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^/${body}$`);
}

const appFiles = walk(APP_DIR);
const routes = appFiles
  .filter((f) => /(^|[\\/])page\.tsx$/.test(f) && !f.endsWith(".test.tsx"))
  .map(routeFromPagePath);
const routeMatchers = routes.map(routeToRegExp);

const LINK_RE = /(?:href\s*=\s*|router\.push\(\s*)["'`](\/[^"'`\n${}]*)["'`]/g;

type Link = { file: string; target: string; line: number };

function collectLinks(): Link[] {
  const sourceFiles = [
    ...appFiles,
    ...walk(join(ROOT, "src", "components")),
  ].filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

  const links: Link[] = [];
  for (const file of sourceFiles) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((lineText, i) => {
      LINK_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = LINK_RE.exec(lineText)) !== null) {
        links.push({ file: relative(ROOT, file), target: m[1], line: i + 1 });
      }
    });
  }
  return links;
}

function isServed(target: string): boolean {
  const path = target.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/")) return true; // handlers, nao paginas
  if (SHELL_ROOT_ROUTES.includes(path)) return true;
  return routeMatchers.some((re) => re.test(path));
}

describe("porta falsa: todo link interno aponta pra rota que responde", () => {
  it("o censo enxerga as rotas e os links deste app", () => {
    expect(routes.length).toBeGreaterThan(30);
    expect(collectLinks().length).toBeGreaterThan(20);
  });

  it("nenhum href/router.push literal aponta pra rota inexistente", () => {
    const broken = collectLinks().filter((l) => !isServed(l.target));
    const report = broken.map((l) => `${l.file}:${l.line} -> ${l.target}`);
    expect(report).toEqual([]);
  });

  it("o consentimento do checkout aponta pros termos que existem de verdade", () => {
    const checkout = readFileSync(join(APP_DIR, "premium", "checkout", "page.tsx"), "utf8");
    expect(checkout).not.toContain("/landing/termos");
    expect(checkout).not.toContain("/landing/privacidade");
    expect(checkout).toContain('href="/termos"');
    expect(checkout).toContain('href="/privacidade"');
  });
});
