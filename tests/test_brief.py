"""New mock news → recommendation flow and link release boundary."""

from __future__ import annotations

import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from app import Handler
from brief_engine import build_brief


BASE = {"work": "회의록에서 결정과 할 일을 시트에 정리하고 싶어요", "policy": "unknown",
        "installation": "unknown", "ecosystem": "google", "data_kind": "unknown"}


class BriefTests(unittest.TestCase):
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
        request = urllib.request.Request(self.url + path, json.dumps(body, ensure_ascii=False).encode(),
                                         {"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.load(error)

    def test_work_and_environment_change_results(self) -> None:
        meeting = build_brief(BASE)
        summary = build_brief({**BASE, "work": "여러 문서를 비교해 출처가 있는 요약 보고서를 만들고 싶어요"})
        self.assertNotEqual(meeting["topic"], summary["topic"])
        self.assertNotEqual([x["title"] for x in meeting["related_news"]],
                            [x["title"] for x in summary["related_news"]])
        self.assertNotEqual({x["id"] for x in meeting["candidates"]},
                            {x["id"] for x in summary["candidates"]})
        allowed = build_brief({**BASE, "policy": "allowed", "installation": "allowed", "data_kind": "public", "hosting": "self_hosted"})
        unknown = next(x for x in meeting["candidates"] if x["id"] == "n8n-meeting")
        ready = next(x for x in allowed["candidates"] if x["id"] == "n8n-meeting")
        self.assertEqual(unknown["status"], "hold")
        self.assertEqual(ready["status"], "possible")
        self.assertNotEqual(meeting["related_news"][0]["context"], allowed["related_news"][0]["context"])
        denied = build_brief({**BASE, "policy": "denied", "installation": "denied"})
        self.assertTrue(any(x["id"] == "local-review" for x in denied["candidates"]))
        self.assertTrue(all(x["status"] == "excluded" for x in denied["candidates"] if x["kind"] != "U-Solve 방법"))
        self.assertEqual(meeting["data_mode"], "mock")
        self.assertEqual(len(meeting["other_news"]), 3)
        unmatched = build_brief({**BASE, "work": "재고 발주 수량을 자동 계산하고 싶어요"})
        self.assertEqual(unmatched["topic"], "unknown")
        self.assertEqual(unmatched["related_news"], [])
        self.assertEqual([item["id"] for item in unmatched["candidates"]], ["local-review"])

    def test_original_link_after_confirmation_only(self) -> None:
        status, brief = self.post("/api/brief", {**BASE, "policy": "allowed", "installation": "allowed", "data_kind": "public"})
        self.assertEqual(status, 200)
        self.assertTrue(all("source_url" not in item for item in brief["candidates"]))
        selected = next(item for item in brief["candidates"] if item["status"] == "possible")
        status, _ = self.post("/api/brief/confirm", {"brief_token": brief["brief_token"], "candidate_id": selected["id"], "confirmed": False})
        self.assertEqual(status, 400)
        status, link = self.post("/api/brief/confirm", {"brief_token": brief["brief_token"], "candidate_id": selected["id"], "confirmed": True})
        self.assertEqual(status, 200)
        self.assertTrue(link["source_url"].startswith("https://"))
        status, held = self.post("/api/brief", BASE)
        self.assertEqual(status, 200)
        selected = held["candidates"][0]
        status, error = self.post("/api/brief/confirm", {"brief_token": held["brief_token"], "candidate_id": selected["id"], "confirmed": True})
        self.assertEqual(status, 400)
        self.assertIn("보류", error["error"])

    def test_question_board_and_separate_news_category(self) -> None:
        with urllib.request.urlopen(self.url + "/") as response:
            home = response.read().decode()
        with urllib.request.urlopen(self.url + "/news") as response:
            news_page = response.read().decode()
        self.assertIn("질문하기", home)
        self.assertIn('href="/news"', home)
        self.assertIn("시연용 예시 질문", home)
        self.assertIn("분야별로 보기", news_page)
        self.assertIn("가상 시연 데이터", news_page)
        with urllib.request.urlopen(self.url + "/api/board") as response:
            board = json.load(response)
        with urllib.request.urlopen(self.url + "/api/news") as response:
            feed = json.load(response)
        self.assertEqual(board["data_mode"], "mock")
        self.assertGreaterEqual(len(board["posts"]), 3)
        self.assertEqual(feed["data_mode"], "mock")
        self.assertTrue(any(item["topic"] == "health" for item in feed["news"]))
        self.assertTrue(any(item["sample_work"] for item in feed["news"]))
        self.assertTrue(all("source_url" not in item for item in feed["news"]))


if __name__ == "__main__":
    unittest.main()
