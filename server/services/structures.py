"""Chemical structures (SMILES) and highlighted structural features with explanations.

The structure is drawn and checked in the browser with RDKit.js; the server stores what was entered
plus the values RDKit computed (canonical SMILES, formula, weight) with the toolkit version.
"""
import json

from ..util import new_id, now
from . import history
from .errors import Invalid
from .history import rows


def _annotation(row: dict) -> dict:
    return {**row, "atom_indices": json.loads(row["atom_indices"])}


def _active_annotations(conn, structure_id: str) -> list[dict]:
    return [_annotation(a) for a in rows(conn, """
        SELECT * FROM structure_annotation WHERE structure_id = ? AND archived_at IS NULL ORDER BY created_at""",
                                         (structure_id,))]


def get_structure(conn, structure_id: str) -> dict:
    structure = history.get_row(conn, "molecular_structure", structure_id)
    entity = history.get_row(conn, "entity", structure["entity_id"])
    return {**structure, "entity_name": entity["name"], "annotations": _active_annotations(conn, structure_id)}


def list_structures(conn, entity_id: str) -> list[dict]:
    history.get_row(conn, "entity", entity_id)
    found = rows(conn, """SELECT id FROM molecular_structure WHERE entity_id = ? AND archived_at IS NULL
                          ORDER BY created_at""", (entity_id,))
    return [get_structure(conn, s["id"]) for s in found]


def create_structure(conn, entity_id: str, *, original_smiles: str, label: str | None = None,
                     canonical_smiles: str | None = None, canonicalizer: str | None = None,
                     molecular_formula: str | None = None, molecular_weight: float | None = None) -> dict:
    history.require_active(history.get_row(conn, "entity", entity_id), "entity")
    structure_id = new_id()
    conn.execute("""
        INSERT INTO molecular_structure (id, entity_id, label, original_smiles, canonical_smiles, canonicalizer,
                                         molecular_formula, molecular_weight, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (structure_id, entity_id, label, original_smiles, canonical_smiles, canonicalizer,
                  molecular_formula, molecular_weight, now()))
    return get_structure(conn, structure_id)


def archive_structure(conn, structure_id: str, reason: str | None = None) -> None:
    history.get_row(conn, "molecular_structure", structure_id)
    conn.execute("UPDATE molecular_structure SET archived_at = ?, archive_reason = ? WHERE id = ? AND archived_at IS NULL",
                 (now(), reason, structure_id))


def _insert_annotation(conn, structure_id, atom_indices, note, color, status_code, replaces_id=None) -> str:
    if not atom_indices:
        raise Invalid("Select at least one atom to highlight.")
    annotation_id = new_id()
    conn.execute("""
        INSERT INTO structure_annotation (id, structure_id, atom_indices, note, color, status_code, replaces_id,
                                          created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                 (annotation_id, structure_id, json.dumps(sorted(set(atom_indices))), note, color, status_code,
                  replaces_id, now()))
    return annotation_id


def create_annotation(conn, structure_id: str, *, atom_indices: list[int], note: str, color: str = "#e0b050",
                      status_code: str = "proposed") -> dict:
    structure = history.get_row(conn, "molecular_structure", structure_id)
    if structure["archived_at"]:
        raise Invalid("This structure is archived.")
    annotation_id = _insert_annotation(conn, structure_id, atom_indices, note, color, status_code)
    return _annotation(history.get_row(conn, "structure_annotation", annotation_id))


def update_annotation(conn, annotation_id: str, changes: dict) -> dict:
    """Never overwrite: save the edited version as a new row and archive the old one."""
    old = history.get_row(conn, "structure_annotation", annotation_id)
    if old["archived_at"]:
        raise Invalid("This note was already replaced or archived.")
    merged = {"atom_indices": json.loads(old["atom_indices"]), "note": old["note"], "color": old["color"],
              "status_code": old["status_code"], **changes}
    new_id_ = _insert_annotation(conn, old["structure_id"], merged["atom_indices"], merged["note"], merged["color"],
                                 merged["status_code"], replaces_id=annotation_id)
    conn.execute("UPDATE structure_annotation SET archived_at = ?, archive_reason = 'edited' WHERE id = ?",
                 (now(), annotation_id))
    return _annotation(history.get_row(conn, "structure_annotation", new_id_))


def archive_annotation(conn, annotation_id: str, reason: str | None = None) -> None:
    history.get_row(conn, "structure_annotation", annotation_id)
    conn.execute("UPDATE structure_annotation SET archived_at = ?, archive_reason = ? WHERE id = ? AND archived_at IS NULL",
                 (now(), reason or "archived", annotation_id))


def annotation_history(conn, annotation_id: str) -> list[dict]:
    """This version and every earlier one it replaced, newest first."""
    chain, current = [], history.get_row(conn, "structure_annotation", annotation_id)
    while current:
        chain.append(_annotation(current))
        current = current["replaces_id"] and history.get_row(conn, "structure_annotation", current["replaces_id"])
    return chain
