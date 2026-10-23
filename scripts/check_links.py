"""Check every link in data/resources.json. Exits 1 if any link is broken (404 or 410).

Runs monthly in GitHub Actions. Uses only the standard library.
Moved pages and sites that block scripts are listed but don't fail the run.
"""
import concurrent.futures as cf
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "resources.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"
BOT_WALLS = ["perfdrive.com", "shieldsquare", "captcha"]


def norm(u):
    u = u.lower().split("#")[0].rstrip("/")
    for p in ("https://", "http://"):
        u = u.removeprefix(p)
    return u.removeprefix("www.")


def check(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            final = r.geturl()
            if any(w in final for w in BOT_WALLS):
                return "check by hand", "bot check page"
            return ("ok", "") if norm(final) == norm(url) else ("moved", final)
    except urllib.error.HTTPError as e:
        return ("BROKEN" if e.code in (404, 410) else "check by hand", f"HTTP {e.code}")
    except Exception as e:
        return "check by hand", type(e).__name__


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    items = [(r["name"], r["link"]) for r in data["resources"] + data["learning"] if r["link"].startswith("http")]
    with cf.ThreadPoolExecutor(16) as ex:
        results = list(ex.map(lambda i: check(i[1]), items))

    broken = 0
    for (name, url), (status, detail) in zip(items, results):
        if status == "ok":
            continue
        broken += status == "BROKEN"
        print(f"{status:14} {name}\n{'':14} {url}" + (f" -> {detail}" if detail else ""))
    print(f"\nChecked {len(items)} links: {broken} broken.")
    sys.exit(1 if broken else 0)


if __name__ == "__main__":
    main()
