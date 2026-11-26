#!/usr/bin/env python3
"""Turn the downloaded eCFR XML and POMS HTML into the bench corpus.

The source files are United States government works. The script does not
paraphrase them. It keeps paragraph text so the grader can quote it.
"""

from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/tmp/ssa-src")
OUT = ROOT / "corpus"
ECFR_DATE = "2026-11-19"

# Dollar amounts published by SSA. 2023–2026 are confirmed against SSA COLA
# fact sheets (and, for 2026, 90 FR 49047). 2015–2022 and 2027 are the
# figures on the OACT SGA table retrieved for this corpus on 2026-11-26:
# https://www.ssa.gov/OACT/COLA/sga.html
SGA = [
    {"year": 2015, "blind": 1820, "nonBlind": 1090, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2016, "blind": 1820, "nonBlind": 1130, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2017, "blind": 1950, "nonBlind": 1170, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2018, "blind": 1970, "nonBlind": 1180, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2019, "blind": 2040, "nonBlind": 1220, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2020, "blind": 2110, "nonBlind": 1260, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2021, "blind": 2190, "nonBlind": 1310, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2022, "blind": 2260, "nonBlind": 1350, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
    {"year": 2023, "blind": 2460, "nonBlind": 1470, "source": "SSA COLA Fact Sheet 2024, https://www.ssa.gov/news/en/cola/factsheets/2024.html"},
    {"year": 2024, "blind": 2590, "nonBlind": 1550, "source": "SSA COLA Fact Sheet 2024; SSA Red Book, What's New in 2024"},
    {"year": 2025, "blind": 2700, "nonBlind": 1620, "source": "SSA COLA Fact Sheet 2026, comparison column for 2025"},
    {"year": 2026, "blind": 2830, "nonBlind": 1690, "source": "90 FR 49047 (Nov. 3, 2025); SSA COLA Fact Sheet 2026"},
    {"year": 2027, "blind": 2950, "nonBlind": 1770, "source": "SSA OACT SGA table, https://www.ssa.gov/OACT/COLA/sga.html"},
]


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def para_text(el: ET.Element) -> str:
    return squash("".join(el.itertext()))


def load_xml(path: Path) -> ET.Element:
    return ET.parse(path).getroot()


def section_record(path: Path) -> dict:
    root = load_xml(path)
    heading = ""
    paragraphs: list[str] = []
    for el in root.iter():
        if el.tag == "HEAD" and not heading:
            heading = para_text(el)
        elif el.tag == "P":
            text = para_text(el)
            if text:
                paragraphs.append(text)
    section_id = path.stem
    part = section_id.split(".")[0]
    return {
        "id": section_id,
        "citation": f"20 CFR {section_id}",
        "heading": heading,
        "source": (
            "https://www.ecfr.gov/api/versioner/v1/full/"
            f"{ECFR_DATE}/title-20.xml?part={part}&section={section_id}"
        ),
        "asOf": ECFR_DATE,
        "paragraphs": paragraphs,
    }


def cell_text(td: ET.Element) -> tuple[str, list[str]]:
    notes: list[str] = []

    def walk(el: ET.Element) -> str:
        if el.tag == "sup":
            note = squash("".join(el.itertext()))
            if note:
                notes.append(note)
            return ""
        chunks: list[str] = []
        if el.text:
            chunks.append(el.text)
        for child in list(el):
            chunks.append(walk(child))
            if child.tail:
                chunks.append(child.tail)
        return "".join(chunks)

    return squash(walk(td)), notes


def is_ditto(text: str) -> bool:
    cleaned = re.sub(r"[.\s…]+", "", text).lower()
    return cleaned == "do"


def parse_grids(path: Path) -> dict:
    root = load_xml(path)
    prose: list[str] = []
    for el in root.iter("P"):
        text = para_text(el)
        if text:
            prose.append(text)
    rules: list[dict] = []
    for table in root.iter("TABLE"):
        caption = ""
        cap = table.find("CAPTION")
        if cap is not None:
            caption = para_text(cap)
        if "Table No." not in caption:
            continue
        lower = caption.lower()
        if "sedentary" in lower:
            exertional = "sedentary"
        elif "light" in lower:
            exertional = "light"
        elif "medium" in lower:
            exertional = "medium"
        else:
            continue
        table_no = ""
        match = re.search(r"Table No\.\s*(\d+)", caption)
        if match:
            table_no = match.group(1)
        previous = ["", "", "", ""]
        last_decision = ""
        for row in table.iter("TR"):
            cells = [cell_text(td) for td in row.findall("TD")]
            if len(cells) < 5:
                continue
            values: list[str] = []
            notes: list[str] = []
            for index, (text, cell_notes) in enumerate(cells[:4]):
                notes.extend(cell_notes)
                if is_ditto(text):
                    text = previous[index]
                previous[index] = text
                values.append(text)
            notes.extend(cells[4][1])
            decision_text = cells[4][0]
            if is_ditto(decision_text):
                decision_text = last_decision
            else:
                last_decision = decision_text
            decision_key = decision_text.lower().rstrip(".").strip()
            if decision_key == "disabled":
                decision = "disabled"
            elif decision_key == "not disabled":
                decision = "not-disabled"
            else:
                raise SystemExit(f"Unrecognized grid decision {decision_text!r}")
            rule_id = values[0].strip()
            if not re.fullmatch(r"\d{3}\.\d{2}", rule_id):
                continue
            rules.append(
                {
                    "id": rule_id,
                    "table": table_no,
                    "exertional": exertional,
                    "age": values[1],
                    "education": values[2],
                    "experience": values[3],
                    "decision": decision,
                    "footnotes": notes,
                }
            )
    return {
        "citation": "20 CFR Part 404 Subpart P Appendix 2",
        "source": (
            "https://www.ecfr.gov/api/versioner/v1/full/"
            f"{ECFR_DATE}/title-20.xml?part=404&appendix=Appendix%202%20to%20Subpart%20P%20of%20Part%20404"
        ),
        "asOf": ECFR_DATE,
        "prose": prose,
        "rules": rules,
    }


def parse_listings(path: Path) -> list[dict]:
    root = load_xml(path)
    paragraphs = [para_text(el) for el in root.iter("P")]
    paragraphs = [p for p in paragraphs if p]
    listings: list[dict] = []
    current: dict | None = None
    starter = re.compile(r"^(\d{1,3}\.\d{2})\b(.*)$")
    for paragraph in paragraphs:
        match = starter.match(paragraph)
        if match:
            if current:
                listings.append(current)
            current = {
                "id": match.group(1),
                "title": squash(match.group(2)),
                "paragraphs": [paragraph],
            }
        elif current:
            current["paragraphs"].append(paragraph)
    if current:
        listings.append(current)
    # The same number can head both an introductory cross-reference and the
    # criteria. Keep the longer block.
    best: dict[str, dict] = {}
    for listing in listings:
        previous = best.get(listing["id"])
        if previous is None or len(listing["paragraphs"]) > len(previous["paragraphs"]):
            best[listing["id"]] = listing
    ordered = sorted(best.values(), key=lambda item: [int(n) for n in item["id"].split(".")])
    return ordered


def html_to_paragraphs(path: Path) -> list[str]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    raw = re.sub(r"(?is)<script\b.*?</script>", " ", raw)
    raw = re.sub(r"(?is)<style\b.*?</style>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    raw = re.sub(r"(?i)</(p|div|tr|h1|h2|h3|li|table)>", "\n", raw)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = unescape(raw)
    paragraphs = []
    for block in raw.splitlines():
        text = squash(block)
        if len(text) > 40:
            paragraphs.append(text)
    return paragraphs


def write(name: str, payload: object) -> str:
    path = OUT / name
    data = json.dumps(payload, ensure_ascii=False, indent=1)
    path.write_text(data + "\n", encoding="utf-8")
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sections = []
    for folder in ("404", "416"):
        for path in sorted((SRC / folder).glob("*.xml")):
            if path.stem.startswith("appendix"):
                continue
            sections.append(section_record(path))
    grids = parse_grids(SRC / "404" / "appendix-2.xml")
    listings = parse_listings(SRC / "404" / "appendix-1.xml")
    poms = []
    poms_dir = SRC / "ssr"
    labels = {
        "POMS-DI24503.025.html": {
            "id": "DI 24503.025",
            "title": "Evaluating Medical Opinions and Prior Administrative Medical Findings — claims filed on or after March 27, 2017",
            "source": "https://secure.ssa.gov/poms.nsf/lnx/0424503025",
        },
        "POMS-DI24503.030.html": {
            "id": "DI 24503.030",
            "title": "Evaluating Medical Opinions and Prior Administrative Medical Findings — claims filed before March 27, 2017",
            "source": "https://secure.ssa.gov/poms.nsf/lnx/0424503030",
        },
    }
    quick = Path("/home/ubuntu/.cursor/projects/agent-repos-Warbucks/agent-tools/a5869353-86a1-474b-a798-200bca35f2b8.txt")
    if quick.exists():
        poms.append(
            {
                "id": "DI 25001.001",
                "title": "Medical and Vocational Quick Reference Guide",
                "source": "https://secure.ssa.gov/poms.nsf/lnx/0425001001",
                "asOf": "2026-02-04",
                "paragraphs": [line.strip() for line in quick.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip()],
            }
        )
    for filename, meta in labels.items():
        file_path = poms_dir / filename
        if file_path.exists():
            poms.append({**meta, "asOf": "retrieved 2026-11-26", "paragraphs": html_to_paragraphs(file_path)})

    hashes = {
        "sections.json": write("sections.json", sections),
        "grids.json": write("grids.json", grids),
        "listings.json": write("listings.json", listings),
        "poms.json": write("poms.json", poms),
        "sga.json": write(
            "sga.json",
            {
                "rule": "20 CFR 404.1574(b)(2) and (b)(3): earnings that average more than the yearly amount ordinarily show SGA. Earnings equal to or less than that amount ordinarily show that the person has not engaged in SGA.",
                "amounts": SGA,
            },
        ),
    }
    manifest = {
        "asOf": ECFR_DATE,
        "built": "2026-11-26",
        "sections": len(sections),
        "listings": len(listings),
        "gridRules": len(grids["rules"]),
        "sha256": hashes,
    }
    write("manifest.json", manifest)
    ages = sorted({rule["age"] for rule in grids["rules"]})
    educations = sorted({rule["education"] for rule in grids["rules"]})
    experiences = sorted({rule["experience"] for rule in grids["rules"]})
    print(json.dumps({"manifest": manifest, "ages": ages, "educations": educations, "experiences": experiences}, indent=2))


if __name__ == "__main__":
    main()
