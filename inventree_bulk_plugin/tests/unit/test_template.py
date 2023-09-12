import unittest

from ...BulkGenerator.template import Template, to_csv, from_csv, to_json, from_json


class TemplateFiltersTestCase(unittest.TestCase):
    def test_to_csv(self):
        csv = [{"a": "aa", "b": "bb"}, {"a": "aaa", "b": "bbb"}]
        self.assertEqual(to_csv(csv), "a,b\r\naa,bb\r\naaa,bbb\r\n")

        csv = [{"a": "aa", "b": "bb"}, {"a": "aaa", "b": "bbb"}]
        self.assertEqual(to_csv(csv, delimiter="|"), "a|b\r\naa|bb\r\naaa|bbb\r\n")

    def test_from_csv(self):
        csv = "a,b\naa,bb\naaa,bbb"
        self.assertEqual(from_csv(csv), [{"a": "aa", "b": "bb"}, {"a": "aaa", "b": "bbb"}])

        csv = "a|b\naa|bb\naaa|bbb"
        self.assertEqual(from_csv(csv, delimiter="|"), [{"a": "aa", "b": "bb"}, {"a": "aaa", "b": "bbb"}])

    def test_to_json(self):
        json = [{'a': 1, 'b': 2}, {'c': {'e': 3}}]
        self.assertEqual(to_json(json), '[{"a": 1, "b": 2}, {"c": {"e": 3}}]')

        json = [{'a': 1, 'b': 2}, {'c': {'e': 3}}]
        self.assertEqual(to_json(json, indent=2), '''[
  {
    "a": 1,
    "b": 2
  },
  {
    "c": {
      "e": 3
    }
  }
]''')

    def test_from_json(self):
        json = '[{"a": 1, "b": 2}, {"c": {"e": 3}}]'
        self.assertEqual(from_json(json), [{'a': 1, 'b': 2}, {'c': {'e': 3}}])


class TemplateTestCase(unittest.TestCase):
    def test_template_filters(self):
        template = '{% set a = "a,b,c,d\naa,bb,cc,dd"|from_csv|to_json(indent=2) %}{{a}}'
        rendered = Template(template).compile().render()
        self.assertEqual(rendered, """[
  {
    "a": "aa",
    "b": "bb",
    "c": "cc",
    "d": "dd"
  }
]""")
