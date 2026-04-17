import { describe, expect, it } from "vitest";

import { scanPolyglotFile } from "./polyglot-rules.js";

const allOn = () => true;

describe("polyglot-rules", () => {
  it("flags secrets in python", () => {
    const v = scanPolyglotFile(
      "/tmp/x.py",
      'API_KEY = "PI_CLI_SYNTHETIC_SECRET_ABCDEFGH123456"\n',
      allOn
    );
    expect(v.some((x) => x.rule === "no-hardcoded-secret")).toBe(true);
  });

  it("flags secrets in yaml (config scan)", () => {
    const v = scanPolyglotFile(
      "/tmp/ci.yml",
      "token: PI_CLI_SYNTHETIC_SECRET_ABCDEFGH123456\n",
      allOn
    );
    expect(v.some((x) => x.rule === "no-hardcoded-secret")).toBe(true);
  });

  it("does not run SQL heuristics on yaml", () => {
    const v = scanPolyglotFile(
      "/tmp/x.yaml",
      'query: "SELECT * FROM t WHERE id = " + user\n',
      allOn
    );
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(false);
  });

  it("flags f-string SQL in python", () => {
    const v = scanPolyglotFile("/tmp/q.py", 'cursor.execute(f"SELECT {x}")\n', allOn);
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(true);
  });

  it("flags string concat SQL in go", () => {
    const v = scanPolyglotFile("/tmp/q.go", 'db.Query("SELECT * FROM t WHERE id = " + id)\n', allOn);
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(true);
  });

  it("flags JDBC-style concat in java", () => {
    const v = scanPolyglotFile(
      "/tmp/Dao.java",
      'stmt.execute("SELECT * FROM u WHERE id = " + userId);\n',
      allOn
    );
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(true);
  });

  it("does not flag benign java line without concat", () => {
    const v = scanPolyglotFile("/tmp/Dao.java", 'stmt.execute("SELECT * FROM u WHERE id = ?");\n', allOn);
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(false);
  });

  it("flags ruby interpolation in execute string", () => {
    const v = scanPolyglotFile("/tmp/m.rb", 'conn.execute("DELETE FROM t WHERE id = \'#{id}\'")\n', allOn);
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(true);
  });

  it("flags mysqli_query with concatenation in php", () => {
    const v = scanPolyglotFile(
      "/tmp/x.php",
      'mysqli_query($conn, "SELECT * FROM t WHERE id = " . $_GET["id"]);\n',
      allOn
    );
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(true);
  });

  it("flags eval in shell", () => {
    const v = scanPolyglotFile("/tmp/run.sh", 'eval "$1"\n', allOn);
    expect(v.some((x) => x.rule === "no-unsafe-shell-pattern")).toBe(true);
  });

  it("flags curl piped to bash", () => {
    const v = scanPolyglotFile("/tmp/install.sh", "curl -sSL https://x.example/install | bash\n", allOn);
    expect(v.some((x) => x.rule === "no-unsafe-shell-pattern")).toBe(true);
  });

  it("skips SQL heuristics on headers but still scans secrets", () => {
    const secretLine = 'static const char *k = "PI_CLI_SYNTHETIC_SECRET_ABCDEFGH123456";\n';
    const sqlish = 'void run() { execute("SELECT " + x); }\n';
    const v = scanPolyglotFile("/tmp/x.h", secretLine + sqlish, allOn);
    expect(v.some((x) => x.rule === "no-hardcoded-secret")).toBe(true);
    expect(v.some((x) => x.rule === "no-sql-injection-pattern")).toBe(false);
  });

  it("respects enabled() gate", () => {
    const enabled = (id: string) => id === "no-hardcoded-secret";
    const v = scanPolyglotFile("/tmp/a.sh", 'eval "rm -rf /"\n', enabled);
    expect(v.some((x) => x.rule === "no-unsafe-shell-pattern")).toBe(false);
  });
});
