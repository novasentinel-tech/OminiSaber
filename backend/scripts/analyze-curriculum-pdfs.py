"""Inspeciona PDFs curriculares sem alterar os documentos de origem."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pdfplumber


SKILL_RE = re.compile(r"\bEM\d{2}[A-Z]{2,3}\d{2,3}(?:[A-Z]{3}[A-Za-z]?)?(?:/ES)?\b")
DESCRIPTOR_RE = re.compile(r"\bD\d{3}(?:_[A-Z])?\b")


def analyze(path_value: str) -> dict[str, object]:
    path = Path(path_value)
    with pdfplumber.open(path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        pages = len(pdf.pages)
    return {
        "file": path.name,
        "path": str(path),
        "pages": pages,
        "characters": len(text),
        "skills": sorted(set(SKILL_RE.findall(text))),
        "descriptors": sorted(set(DESCRIPTOR_RE.findall(text))),
    }


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "--crop":
        source = Path(sys.argv[2])
        page_number = int(sys.argv[3])
        with pdfplumber.open(source) as pdf:
            page = pdf.pages[page_number - 1]
            for label, left, right in (("left", 0, .43), ("middle", .43, .79), ("right", .79, 1)):
                print(f"\n===== {label.upper()} =====\n")
                print(page.crop((page.width * left, 0, page.width * right, page.height)).extract_text() or "")
    elif len(sys.argv) >= 4 and sys.argv[1] == "--pages":
        source = Path(sys.argv[2])
        wanted = {int(value) for value in sys.argv[3].split(",")}
        with pdfplumber.open(source) as pdf:
            for page_number in sorted(wanted):
                print(f"\n===== PAGE {page_number} =====\n")
                print(pdf.pages[page_number - 1].extract_text() or "")
    else:
        for source in sys.argv[1:]:
            print(json.dumps(analyze(source), ensure_ascii=False))
