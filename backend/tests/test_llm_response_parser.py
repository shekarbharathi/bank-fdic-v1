"""Unit tests for llm_response_parser."""
import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from services.llm_response_parser import (  # noqa: E402
    OutOfScopeError,
    build_fallback_plan_from_sql,
    parse_structured_response,
    strip_json_from_markdown,
    try_parse_structured_response,
)


class TestStripJsonFromMarkdown(unittest.TestCase):
    def test_plain_json(self):
        raw = '{"intent": "browse_table", "sql": "SELECT 1", "visualization": {"type": "table", "title": ""}}'
        self.assertEqual(strip_json_from_markdown(raw), raw)

    def test_fenced_json(self):
        inner = '{"intent": "browse_table", "sql": "SELECT 1", "visualization": {"type": "table", "title": "t"}}'
        raw = f"```json\n{inner}\n```"
        self.assertEqual(strip_json_from_markdown(raw), inner)


class TestParseStructuredResponse(unittest.TestCase):
    def _minimal(self, extra_viz=None):
        viz = {"type": "table", "title": "Results"}
        if extra_viz:
            viz.update(extra_viz)
        import json

        return json.dumps(
            {
                "intent": "browse_table",
                "sql": " SELECT 1 ",
                "visualization": viz,
                "entities": {"foo": "bar"},
            }
        )

    def test_valid_json(self):
        plan = parse_structured_response(self._minimal())
        self.assertEqual(plan.intent, "browse_table")
        self.assertEqual(plan.sql, "SELECT 1")
        self.assertEqual(plan.visualization["type"], "table")
        self.assertEqual(plan.visualization["title"], "Results")
        self.assertEqual(plan.entities, {"foo": "bar"})

    def test_config_optional(self):
        raw = self._minimal({"config": {"x": 1}})
        plan = parse_structured_response(raw)
        self.assertEqual(plan.visualization["config"], {"x": 1})

    def test_out_of_scope_raises(self):
        with self.assertRaises(OutOfScopeError):
            parse_structured_response('{"error": "out_of_scope"}')

    def test_missing_sql_raises(self):
        import json

        bad = json.dumps({"intent": "browse_table", "visualization": {"type": "table", "title": ""}})
        with self.assertRaises(ValueError):
            parse_structured_response(bad)

    def test_invalid_json_raises(self):
        with self.assertRaises(ValueError):
            parse_structured_response("not json {")


class TestTryParseStructuredResponse(unittest.TestCase):
    def test_returns_none_on_invalid(self):
        self.assertIsNone(try_parse_structured_response("{"))

    def test_re_raises_out_of_scope(self):
        with self.assertRaises(OutOfScopeError):
            try_parse_structured_response('{"error": "out_of_scope"}')


class TestBuildFallbackPlanFromSql(unittest.TestCase):
    def test_defaults(self):
        plan = build_fallback_plan_from_sql("SELECT * FROM institutions LIMIT 5")
        self.assertEqual(plan.intent, "browse_table")
        self.assertEqual(plan.sql, "SELECT * FROM institutions LIMIT 5")
        self.assertEqual(plan.visualization["type"], "table")


if __name__ == "__main__":
    unittest.main()
