"""Checks the local search → simulation → confirmation boundary without AI calls."""

from __future__ import annotations

import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from app import Handler
from solution_store import CATALOG, search


class DiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def post(self, path: str, body: dict) -> tuple[int, dict]:
        request = urllib.request.Request(
            self.url + path,
            json.dumps(body, ensure_ascii=False).encode(),
            {"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.load(error)

    def test_catalog_evidence_and_task_routing(self) -> None:
        self.assertEqual(len(CATALOG), 5)
        self.assertEqual(search("여러 문서를 비교해 보고서를 만들고 싶다")[0]["id"], "n8n-content-summary")
        self.assertEqual(search("구글 문서 양식을 채워 PDF로 만들고 싶다")[0]["id"], "n8n-template-pdf")
        self.assertEqual(search("재고 발주를 자동화하고 싶다"), [])
        with urllib.request.urlopen(self.url + "/api/catalog") as response:
            self.assertEqual(json.load(response)["count"], 5)
        with urllib.request.urlopen(self.url + "/api/demo?task=meeting") as response:
            self.assertTrue(json.load(response)["synthetic"])

    def test_link_is_available_only_after_confirmation(self) -> None:
        status, discovery = self.post("/api/discover", {"query": "회의록의 할 일을 시트에 정리하고 싶다"})
        self.assertEqual(status, 200)
        self.assertTrue(discovery["matches"])
        self.assertNotIn("source_url", discovery["matches"][0])
        selected = discovery["matches"][0]["id"]
        status, invalid = self.post("/api/simulate", {"discovery_token": "wrong", "solution_id": selected})
        self.assertEqual(status, 400)
        self.assertIn("다시 선택", invalid["error"])
        status, simulation = self.post("/api/simulate", {
            "discovery_token": discovery["discovery_token"], "solution_id": selected,
        })
        self.assertEqual(status, 200)
        self.assertIn("회의록", simulation["query"])
        self.assertTrue(simulation["source_steps"])
        self.assertTrue(simulation["proposed_steps"])
        self.assertNotIn("source_url", simulation)
        status, _ = self.post("/api/confirm", {"simulation_token": simulation["simulation_token"], "confirmed": False, "external_ai_policy": "allowed"})
        self.assertEqual(status, 400)
        status, _ = self.post("/api/confirm", {"simulation_token": simulation["simulation_token"], "confirmed": True})
        self.assertEqual(status, 400)
        status, held = self.post("/api/confirm", {"simulation_token": simulation["simulation_token"], "confirmed": True, "external_ai_policy": "unknown"})
        self.assertEqual(status, 200)
        self.assertIsNone(held["source_url"])
        self.assertEqual(held["connection_status"], "policy_unknown")
        status, denied = self.post("/api/confirm", {"simulation_token": simulation["simulation_token"], "confirmed": True, "external_ai_policy": "denied"})
        self.assertEqual(status, 200)
        self.assertIsNone(denied["source_url"])
        self.assertEqual(denied["connection_status"], "blocked")
        status, connection = self.post("/api/confirm", {"simulation_token": simulation["simulation_token"], "confirmed": True, "external_ai_policy": "allowed"})
        self.assertEqual(status, 200)
        self.assertTrue(connection["source_url"].startswith("https://"))
        self.assertIn("실행 전", connection["execution_status"])
        status, _ = self.post("/api/confirm", {"simulation_token": simulation["simulation_token"], "confirmed": True, "external_ai_policy": "allowed"})
        self.assertEqual(status, 400)

    def test_no_match_asks_for_more_detail(self) -> None:
        status, result = self.post("/api/discover", {"query": "재고 발주를 자동화하고 싶다"})
        self.assertEqual(status, 200)
        self.assertEqual(result["matches"], [])
        self.assertTrue(result["next_question"])

    def test_explicit_policy_conflict_blocks_simulation(self) -> None:
        status, discovery = self.post("/api/discover", {"query": "외부 AI 금지인 회사에서 회의록 할 일을 정리하고 싶다"})
        self.assertEqual(status, 200)
        self.assertTrue(discovery["matches"])
        self.assertTrue(all(item["blocked"] for item in discovery["matches"]))
        status, _ = self.post("/api/simulate", {
            "discovery_token": discovery["discovery_token"],
            "solution_id": discovery["matches"][0]["id"],
        })
        self.assertEqual(status, 400)
        self.assertTrue(all(item["blocked"] for item in search("외부 AI를 쓸 수 없는 회사에서 회의록을 정리하고 싶다")))
        self.assertTrue(all(item["blocked"] for item in search("고객 회의록은 밖으로 못 보내요. 할 일을 정리해 줘")))
        self.assertTrue(all(item["blocked"] for item in search("보안 규정상 외부 서비스 사용 안 돼요. 회의록 정리하고 싶어요")))

    def test_unsupported_formats_are_disclosed(self) -> None:
        query = "PDF 회의록을 읽어 엑셀로 할 일 표를 만들고 싶다"
        results = search(query)
        self.assertTrue(results)
        self.assertTrue(any("PDF 입력" in issue for issue in results[0]["condition_issues"]))
        self.assertTrue(any("Excel 파일 출력" in issue for issue in results[0]["condition_issues"]))
        self.assertEqual(results[0]["fit_status"], "형식 지원 미확인 · 연결 보류")
        status, discovery = self.post("/api/discover", {"query": query})
        self.assertEqual(status, 200)
        status, simulation = self.post("/api/simulate", {
            "discovery_token": discovery["discovery_token"], "solution_id": discovery["matches"][0]["id"],
        })
        self.assertEqual(status, 200)
        status, evidence = self.post("/api/confirm", {
            "simulation_token": simulation["simulation_token"], "confirmed": True, "external_ai_policy": "allowed",
        })
        self.assertEqual(status, 200)
        self.assertEqual(evidence["execution_status"], "형식 지원 미확인 · 연결 보류")
        self.assertIn("연결·적용하지 마세요", evidence["guidance"])


if __name__ == "__main__":
    unittest.main()
