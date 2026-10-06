"""Gera o catálogo curricular comum a partir dos PDFs oficiais da SEDU-ES.

O resultado é determinístico e não depende de acesso ao Supabase. O JSON gerado
é a fonte auditável usada pela migração de catálogo.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import pdfplumber


CODE_PATTERN = r"EM\d{2}[A-Z]{2,3}\d{2,3}(?:[A-Z]{3}[a-z]?)?(?:/ES)?"
CODE_RE = re.compile(rf"\b({CODE_PATTERN})\b")
DESCRIPTOR_RE = re.compile(r"\b(D\d{3}_[PM])\b")
SERIES_RE = re.compile(r"\b([123])ª\s*série\b", re.IGNORECASE)
TRIMESTER_RE = re.compile(r"\b([123])º\s*TRIMESTRE\b", re.IGNORECASE)
SKILL_OVERRIDES = {
    "EM13LP02": "Estabelecer relações entre as partes do texto, tanto na produção como na leitura/escuta, considerando a construção composicional e o estilo do gênero, usando e reconhecendo adequadamente elementos e recursos coesivos diversos que contribuam para a coerência, a continuidade e a progressão temática, tendo em vista as condições de produção e as relações lógico-discursivas envolvidas.",
}
DESCRIPTOR_OVERRIDES = {
    "D025_P": "Reconhecer efeitos de sentido decorrentes do uso da pontuação e de outras notações.",
    "D033_P": "Reconhecer posições distintas entre duas ou mais opiniões relativas ao mesmo fato ou ao mesmo tema.",
    "D039_P": "Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios e outros articuladores.",
    "D057_P": "Interpretar texto com auxílio de material gráfico diverso, como propagandas, quadrinhos e fotografias.",
    "D049_M": "Utilizar relações métricas em um triângulo retângulo na resolução de problemas.",
    "D133_M": "Resolver problemas que envolvam pontos de máximo ou de mínimo no gráfico de uma função polinomial do segundo grau.",
}


def clean(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip(" •\n\t")
    return value.replace(" ,", ",").replace(" .", ".")


def clean_block(value: str) -> str:
    lines = [line for line in (value or "").splitlines() if line.strip() not in {"A", "TI", "1ª", "2ª", "3ª"}]
    return clean("\n".join(lines))


def normalize_code(value: str) -> str:
    code = value.strip().upper()
    extended = re.match(r"^(EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3})([A-Z]{3})([A-Z])(/ES)$", code)
    if extended:
        return f"{extended.group(1)}{extended.group(2)}{extended.group(3).lower()}{extended.group(4)}"
    return code


def bullets(value: str) -> list[str]:
    parts = re.split(r"\n\s*[•▪●]\s*", "\n" + (value or ""))
    return [clean(part) for part in parts if clean(part)]


def column_text(page, left_ratio: float, right_ratio: float, top: float = 0, bottom: float | None = None) -> str:
    bottom = page.height if bottom is None else bottom
    selected = [
        word for word in page.extract_words(use_text_flow=False, keep_blank_chars=False)
        if page.width * left_ratio <= word["x0"] < page.width * right_ratio
        and top <= word["top"] < bottom
    ]
    lines: list[dict[str, object]] = []
    for word in sorted(selected, key=lambda item: (item["top"], item["x0"])):
        line = next((item for item in lines if abs(float(item["top"]) - word["top"]) <= 2.5), None)
        if line is None:
            line = {"top": word["top"], "words": []}
            lines.append(line)
        line["words"].append(word)
    return "\n".join(" ".join(word["text"] for word in sorted(line["words"], key=lambda item: item["x0"])) for line in sorted(lines, key=lambda item: float(item["top"])))


def section(text: str, start: str, stops: tuple[str, ...]) -> str:
    match = re.search(start, text, re.IGNORECASE)
    if not match:
        return ""
    tail = text[match.end():]
    stop_positions = [found.start() for stop in stops if (found := re.search(stop, tail, re.IGNORECASE))]
    return tail[: min(stop_positions) if stop_positions else len(tail)]


def main_skill(left: str) -> tuple[str, str] | None:
    match = re.search(rf"Habilidade\s*\n\s*({CODE_PATTERN})\s*\n", left, re.IGNORECASE)
    if not match:
        return None
    code = normalize_code(match.group(1))
    if code.startswith("EM13CO"):
        return None
    description = section(left[match.start():], rf"{re.escape(match.group(1))}\s*\n", (r"\n\s*(?:A|TI)?\s*Objeto de conhecimento", r"\n\s*(?:A|TI)?\s*Objetos de conhecimento"))
    return code, clean_block(description)


def periods_for_science(right: str, code: str) -> list[int]:
    current = None
    periods: dict[str, set[int]] = defaultdict(set)
    for line in right.splitlines():
        trimester = TRIMESTER_RE.search(line)
        if trimester:
            current = int(trimester.group(1))
        if current:
            for found in CODE_RE.findall(line):
                periods[normalize_code(found)].add(current)
    return sorted(periods.get(code, set()))


def descriptors_from_text(text: str) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    matches = list(DESCRIPTOR_RE.finditer(text))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        description = text[match.end():end]
        description = re.split(r"Tarefas do descritor:?\*?|\n\s*(?:Habilidades da computação|Sugestões de materiais|CAPÍTULO|\d+[ªº]\s*TRIMESTRE)|[•◆★▼■]", description, flags=re.IGNORECASE)[0]
        normalized = clean(description)
        sentence = re.match(r"^(.+?\.)", normalized)
        if sentence:
            normalized = sentence.group(1)
        if not normalized or normalized[0] in ",;:":
            continue
        if normalized:
            results.append({"codigo": match.group(1).upper(), "descricao": normalized})
    unique: dict[str, dict[str, str]] = {}
    for item in results:
        if len(item["descricao"]) > len(unique.get(item["codigo"], {}).get("descricao", "")):
            unique[item["codigo"]] = item
    return list(unique.values())


def table_entries(page, page_number: int, series: int, config: dict[str, object]) -> list[dict[str, object]]:
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    anchors = []
    subject_prefix = "EM13LP" if config["materia_codigo"] == "portugues" else "EM13MAT"
    is_portuguese = config["materia_codigo"] == "portugues"
    anchor_limit = .32 if is_portuguese else .25
    for word in words:
        match = CODE_RE.search(word["text"])
        if match and match.group(1).upper().startswith(subject_prefix) and word["x0"] < page.width * anchor_limit:
            anchors.append((word["top"], normalize_code(match.group(1))))
    anchors = sorted(set(anchors))
    results = []
    for index, (top, code) in enumerate(anchors):
        bottom = anchors[index + 1][0] if index + 1 < len(anchors) else page.height - 22
        if bottom - top < 18:
            continue
        if is_portuguese:
            left_box, descriptor_box, expectation_box = (0, .30), (.30, .67), (.67, .90)
        else:
            left_box, descriptor_box, expectation_box = (0, .235), (.58, .96), (.235, .58)
        left = column_text(page, *left_box, max(0, top - 3), bottom)
        descriptor_text = column_text(page, *descriptor_box, max(0, top - 3), bottom)
        expectation_text = column_text(page, *expectation_box, max(0, top - 3), bottom)
        description = clean_block(re.sub(rf"^.*?{re.escape(code)}\)?\s*", "", left, count=1, flags=re.IGNORECASE | re.DOTALL))
        description = re.split(r"Padrões de desempenho", description, flags=re.IGNORECASE)[0].strip()
        description = re.split(r"\s*\(EM13CO[0-9]{2}\)", description, flags=re.IGNORECASE)[0].strip()
        description = re.split(r"\s+[12]\s+(?:O foco dessa tarefa|Na revista do PAEBES)", description, flags=re.IGNORECASE)[0].strip()
        descriptors = descriptors_from_text(descriptor_text)
        expectations = bullets(expectation_text)
        expectations = [item for item in expectations if not item.startswith("EM13CO") and item != "-"]
        if len(description) >= 20:
            results.append({
                "codigo": code, "descricao": description,
                "materia_codigo": config["materia_codigo"], "serie": series,
                "trimestre": int(config["trimestre"]), "pagina_fonte": page_number,
                "arquivo_fonte": Path(str(config["path"])).name,
                "unidade_tematica": "", "objetos": [],
                "expectativas": expectations, "descritores": descriptors,
            })
    return results


def parse_source(config: dict[str, object]) -> list[dict[str, object]]:
    path = Path(str(config["path"]))
    entries: list[dict[str, object]] = []
    fixed_table_layout = bool(config.get("trimestre") in (2, 3) and config["materia_codigo"] in ("portugues", "matematica"))
    current_series = 1
    last_anchor_page = None
    portuguese_group = 0
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            if fixed_table_layout:
                full_text = page.extract_text() or ""
                if config["materia_codigo"] == "portugues" and "HABILIDADE PRINCIPAL" in full_text:
                    portuguese_group = min(3, portuguese_group + 1)
                    current_series = portuguese_group
                page_series = SERIES_RE.search(full_text)
                if page_series:
                    current_series = int(page_series.group(1))
                if "Visão geral do percurso curricular" in full_text:
                    continue
                page_entries = table_entries(page, page_number, current_series, config)
                if page_entries:
                    entries.extend(page_entries)
                    last_anchor_page = page_number
                continue
            left = page.crop((0, 0, page.width * .45, page.height)).extract_text() or ""
            middle = column_text(page, .40, .79)
            right = page.crop((page.width * .78, 0, page.width, page.height)).extract_text() or ""
            found = main_skill(left)
            if not found:
                continue
            code, description = found
            series_match = SERIES_RE.search(right) or SERIES_RE.search(page.extract_text() or "")
            series = int(series_match.group(1)) if series_match else None
            trimesters = [int(config["trimestre"])] if config.get("trimestre") else periods_for_science(right, code)
            objects_text = section(left, r"Objetos? de conhecimento", (r"\n\s*Temas integradores", r"\n\s*Habilidades da computação", r"\n\s*Práticas sugeridas", r"\n\s*Sugestões de materiais"))
            expectations_text = section(middle, r"Expectativas de aprendizagem", (r"\n\s*Descritores do", r"\n\s*Sugestões de materiais", r"\n\s*Habilidades da computação", r"\n\s*Práticas sugeridas"))
            descriptors_text = section(middle, r"Descritor(?:es)? do (?:PAEBES|SAEB/PAEBES)", (r"\n\s*Habilidades da computação", r"\n\s*Sugestões de materiais"))
            if not series or not trimesters or len(description) < 20:
                continue
            for trimester in trimesters:
                entries.append({
                    "codigo": code,
                    "descricao": description,
                    "materia_codigo": config["materia_codigo"],
                    "serie": series,
                    "trimestre": int(trimester),
                    "pagina_fonte": page_number,
                    "arquivo_fonte": path.name,
                    "unidade_tematica": clean(section(left, r"Unidade Temática", (r"\n\s*Habilidade",))),
                    "objetos": bullets(objects_text),
                    "expectativas": bullets(expectations_text),
                    "descritores": descriptors_from_text(descriptors_text),
                })
    return entries


def build_catalog(sources: list[dict[str, object]]) -> dict[str, object]:
    occurrences = [entry for source in sources for entry in parse_source(source)]
    skills: dict[tuple[str, str], dict[str, object]] = {}
    descriptors: dict[str, dict[str, object]] = {}
    for entry in occurrences:
        skill_key = (str(entry["materia_codigo"]), str(entry["codigo"]))
        skill = skills.setdefault(skill_key, {
            "codigo": entry["codigo"], "materia_codigo": entry["materia_codigo"],
            "descricao": entry["descricao"], "ocorrencias": [],
        })
        if len(str(entry["descricao"])) > len(str(skill["descricao"])):
            skill["descricao"] = entry["descricao"]
        skill["ocorrencias"].append({key: entry[key] for key in (
            "serie", "trimestre", "pagina_fonte", "arquivo_fonte", "unidade_tematica", "objetos", "expectativas", "descritores"
        )})
        for descriptor in entry["descritores"]:
            item = descriptors.setdefault(descriptor["codigo"], {
                "codigo": descriptor["codigo"], "materia_codigo": entry["materia_codigo"],
                "descricao": descriptor["descricao"], "ocorrencias": [],
            })
            if len(descriptor["descricao"]) > len(str(item["descricao"])):
                item["descricao"] = descriptor["descricao"]
            item["ocorrencias"].append({
                "habilidade_codigo": entry["codigo"], "serie": entry["serie"],
                "trimestre": entry["trimestre"], "pagina_fonte": entry["pagina_fonte"],
                "arquivo_fonte": entry["arquivo_fonte"],
            })
    for skill in skills.values():
        if skill["codigo"] in SKILL_OVERRIDES:
            skill["descricao"] = SKILL_OVERRIDES[skill["codigo"]]
    for descriptor in descriptors.values():
        if descriptor["codigo"] in DESCRIPTOR_OVERRIDES:
            descriptor["descricao"] = DESCRIPTOR_OVERRIDES[descriptor["codigo"]]
    return {
        "versao": "2026.1",
        "origem": "SEDU-ES — Orientações Curriculares 2026 / BNCC",
        "materias": ["portugues", "matematica", "fisica", "quimica", "biologia"],
        "fontes": [{"materia_codigo": item["materia_codigo"], "arquivo": Path(str(item["path"])).name, "trimestre": item.get("trimestre")} for item in sources],
        "habilidades": sorted(skills.values(), key=lambda item: (str(item["materia_codigo"]), str(item["codigo"]))),
        "descritores_avaliativos": sorted(descriptors.values(), key=lambda item: str(item["codigo"])),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="backend/data/catalogo-curricular-base-comum-2026.json")
    parser.add_argument("--science-dir", default="tmp/pdfs/curriculo")
    args = parser.parse_args()
    science = Path(args.science_dir)
    sources = [
        {"materia_codigo": "portugues", "trimestre": 1, "path": r"C:\Users\CLEVERSON\Downloads\trabai\EM_D_LP_26_14_04_26.pdf"},
        {"materia_codigo": "portugues", "trimestre": 2, "path": r"C:\Users\CLEVERSON\Downloads\trabai\OCs-2026-EM-2o-tri.pdf"},
        {"materia_codigo": "portugues", "trimestre": 3, "path": r"C:\Users\CLEVERSON\Downloads\trabai\OCs-2026-EM-3o-tri.pdf"},
        {"materia_codigo": "matematica", "trimestre": 1, "path": r"C:\Users\CLEVERSON\Downloads\EM_D_MAT_26_14_04_26.pdf"},
        {"materia_codigo": "matematica", "trimestre": 2, "path": r"C:\Users\CLEVERSON\Downloads\MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},
        {"materia_codigo": "matematica", "trimestre": 3, "path": r"C:\Users\CLEVERSON\Downloads\MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"},
        {"materia_codigo": "fisica", "path": science / "fisica-2026.pdf"},
        {"materia_codigo": "quimica", "path": science / "quimica-2026.pdf"},
        {"materia_codigo": "biologia", "path": science / "biologia-2026.pdf"},
    ]
    catalog = build_catalog(sources)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output), "habilidades": len(catalog["habilidades"]),
        "descritores": len(catalog["descritores_avaliativos"]),
        "ocorrencias": sum(len(item["ocorrencias"]) for item in catalog["habilidades"]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
