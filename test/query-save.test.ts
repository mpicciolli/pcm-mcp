import { describe, expect, it } from "vitest";
import { assertReadOnlyQuery } from "../src/tools/query-save";

describe("assertReadOnlyQuery", () => {
	describe("allowed queries", () => {
		it("accepts a simple SELECT", () => {
			const q = "SELECT * FROM DYN_cyclist";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});

		it("accepts SELECT with a trailing semicolon (strips it)", () => {
			expect(assertReadOnlyQuery("SELECT 1;")).toBe("SELECT 1");
		});

		it("accepts SELECT with trailing semicolon and whitespace", () => {
			// trim() runs before the semicolon strip, so a space before ';' is preserved
			expect(assertReadOnlyQuery("SELECT 1 ;  ")).toBe("SELECT 1 ");
		});

		it("accepts SELECT with leading/trailing whitespace", () => {
			expect(assertReadOnlyQuery("  SELECT id FROM foo  ")).toBe(
				"SELECT id FROM foo",
			);
		});

		it("accepts a WITH … SELECT (CTE)", () => {
			const q =
				"WITH cte AS (SELECT id FROM foo) SELECT * FROM cte WHERE id > 5";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});

		it("accepts lowercase select", () => {
			expect(assertReadOnlyQuery("select * from bar")).toBe(
				"select * from bar",
			);
		});

		it("accepts mixed-case SELECT", () => {
			expect(assertReadOnlyQuery("Select id From foo")).toBe(
				"Select id From foo",
			);
		});

		it("accepts SELECT containing a column named 'update_date' (keyword inside identifier)", () => {
			const q = "SELECT update_date FROM DYN_cyclist";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});

		it("accepts a SELECT whose string literal contains a keyword like 'create'", () => {
			const q = "SELECT * FROM foo WHERE name LIKE '%create%'";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});

		it("accepts a SELECT using the read-only REPLACE() function", () => {
			const q = "SELECT REPLACE(name,'a','b') FROM foo";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});

		it("accepts SELECT with ORDER BY, LIMIT, GROUP BY", () => {
			const q =
				"SELECT name, COUNT(*) AS n FROM foo GROUP BY name ORDER BY n DESC LIMIT 10";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});

		it("accepts SELECT with a JOIN", () => {
			const q = "SELECT a.id, b.name FROM a INNER JOIN b ON a.id = b.a_id";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});
	});

	describe("empty / blank queries", () => {
		it("rejects an empty string", () => {
			expect(() => assertReadOnlyQuery("")).toThrowError("Query is empty.");
		});

		it("rejects a string that is only whitespace", () => {
			expect(() => assertReadOnlyQuery("   ")).toThrowError("Query is empty.");
		});

		it("rejects a bare semicolon", () => {
			expect(() => assertReadOnlyQuery(";")).toThrowError("Query is empty.");
		});

		it("rejects whitespace + semicolon", () => {
			expect(() => assertReadOnlyQuery("  ;  ")).toThrowError(
				"Query is empty.",
			);
		});
	});

	describe("multiple statements", () => {
		it("rejects two SELECT statements separated by a semicolon", () => {
			expect(() => assertReadOnlyQuery("SELECT 1; SELECT 2")).toThrowError(
				"Only a single statement is allowed",
			);
		});

		it("rejects SELECT followed by a write statement", () => {
			expect(() =>
				assertReadOnlyQuery("SELECT 1; DROP TABLE foo"),
			).toThrowError("Only a single statement is allowed");
		});
	});

	describe("non-SELECT openers", () => {
		it("rejects a bare INSERT", () => {
			expect(() =>
				assertReadOnlyQuery("INSERT INTO foo VALUES (1)"),
			).toThrowError("Only read-only SELECT");
		});

		it("rejects UPDATE", () => {
			expect(() => assertReadOnlyQuery("UPDATE foo SET bar = 1")).toThrowError(
				"Only read-only SELECT",
			);
		});

		it("rejects DELETE", () => {
			expect(() => assertReadOnlyQuery("DELETE FROM foo")).toThrowError(
				"Only read-only SELECT",
			);
		});

		it("rejects DROP TABLE", () => {
			expect(() => assertReadOnlyQuery("DROP TABLE foo")).toThrowError(
				"Only read-only SELECT",
			);
		});

		it("rejects CREATE TABLE", () => {
			expect(() =>
				assertReadOnlyQuery("CREATE TABLE foo (id INTEGER)"),
			).toThrowError("Only read-only SELECT");
		});

		it("rejects PRAGMA", () => {
			expect(() => assertReadOnlyQuery("PRAGMA table_info(foo)")).toThrowError(
				"Only read-only SELECT",
			);
		});
	});

	describe("ATTACH / DETACH", () => {
		it("rejects ATTACH stacked after a SELECT", () => {
			expect(() =>
				assertReadOnlyQuery("SELECT * FROM foo; ATTACH DATABASE 'x' AS y"),
			).toThrowError("Only a single statement is allowed");
		});

		it("rejects ATTACH as a standalone statement opener", () => {
			expect(() =>
				assertReadOnlyQuery("ATTACH DATABASE 'evil.db' AS e"),
			).toThrowError("Only read-only SELECT");
		});

		it("rejects DETACH as a standalone statement opener", () => {
			expect(() => assertReadOnlyQuery("DETACH DATABASE e")).toThrowError(
				"Only read-only SELECT",
			);
		});
	});

	describe("write enforcement delegated to the engine", () => {
		it("passes a WITH … DELETE CTE through the static guard", () => {
			const q = "WITH x AS (SELECT 1) DELETE FROM foo";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});

		it("passes a SELECT mentioning a write keyword through the static guard", () => {
			const q = "SELECT * FROM foo WHERE note = 'please update'";
			expect(assertReadOnlyQuery(q)).toBe(q);
		});
	});
});
