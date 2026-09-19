"""Download the official WA Health policy sources used by the application.

Re-run with the bundled Python runtime. Full texts stay in data/policies;
src/data/policies.json is the reviewed, concise application index.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import hashlib
import json
from datetime import datetime, timezone
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "policies"
BASE = "https://www.health.wa.gov.au"
RATIO = BASE + "/~/media/Corp/Policy-Frameworks/Clinical-Services-and-Planning/Nurse-Midwife-to-Patient-Ratios-Policy/"
AI = BASE + "/~/media/Corp/Policy-Frameworks/Digital-Health/Artificial-Intelligence-Policy/"
LEAVE = BASE + "/~/media/Corp/Policy-Frameworks/Workforce-and-employment/Management-of-Accrued-Leave-Policy/"
SOURCES = {
    "ratios": RATIO + "Nurse-Midwife-to-Patient-Ratios-Policy.pdf",
    "ratios-scope": RATIO + "Supporting/Nurse-Midwife-to-Patient-Ratios-Wards-Units-in-Scope-for-Implementation.pdf",
    "accrued-leave": LEAVE + "Management-of-Accrued-Leave-Policy.pdf",
    "ai-policy": AI + "Artificial-Intelligence-Policy.pdf",
    "ai-standard": AI + "Supporting/ArtificiaI-Intelligence-Standard.pdf",
    "anf-2024": BASE + "/~/media/Corp/Documents/Health-for/Industrial-relations/Awards-and-agreements/Nurses-Registered-and-Enrolled-Mental-Health/WA-Health-ANF-Agreement-2024.pdf",
    "uwu-2024": BASE + "/~/media/Corp/Documents/Health-for/Industrial-relations/Awards-and-agreements/Enrolled-nurses/WA-Health-System--United-Workers-Union-WA--Enrolled-Nurses-Assistants-in-Nursing-Aboriginal-Health-W.pdf",
    "ama-2024": BASE + "/~/media/Corp/Documents/Health-for/Industrial-relations/Awards-and-agreements/Doctors/Medical-practitioners-AMA-industrial-agreement-2024.pdf",
    "workforce-framework": RATIO + "Supporting/Nursing-and-Midwifery-Workforce-Planning-Framework.pdf",
}

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    records = []
    for name, url in SOURCES.items():
        with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as response:
            content = response.read()
        if not content.startswith(b"%PDF"):
            raise ValueError(f"Not a PDF: {url}")
        path = DEST / f"{name}.pdf"
        path.write_bytes(content)
        pages = PdfReader(path).pages
        (DEST / f"{name}.txt").write_text("\n\n".join(f"[PDF PAGE {i + 1}]\n{page.extract_text()}" for i, page in enumerate(pages)), encoding="utf-8")
        records.append({"id": name, "url": url, "bytes": len(content), "pages": len(pages), "sha256": hashlib.sha256(content).hexdigest()})
        print(f"{name}: {len(pages)} pages, {len(content)} bytes", flush=True)
    (DEST / "manifest.json").write_text(json.dumps({"retrievedAt": datetime.now(timezone.utc).isoformat(), "documents": records}, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
