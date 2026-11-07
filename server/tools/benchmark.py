"""Speed check on a large synthetic knowledge base (M13; spec 5.1: "evaluate with realistic graph sizes").

Run:  .venv\\Scripts\\python -m server.tools.benchmark  [entities] [relationships]

It builds a throw-away database in a temporary folder (never your real data), then times the queries the
interface uses. Results are printed as a table; docs/ACCEPTANCE.md records a run.
"""
import os
import random
import sys
import tempfile
import time
from pathlib import Path


def main(n_entities: int = 50_000, n_relationships: int = 300_000) -> None:
    tmp = Path(tempfile.mkdtemp(prefix="pharmagraph-benchmark-"))
    os.environ["PHARMAGRAPH_DATA"] = str(tmp)  # before importing the app's modules that read it
    from .. import config
    from ..db.connection import connect, transaction
    from ..db.migrate import migrate
    from ..services import backup, entries, graph, relationships, search
    from ..util import new_id, now

    random.seed(42)
    migrate(config.db_path())
    conn = connect(config.db_path())
    syllables = ["pa", "ra", "ce", "ta", "mol", "zi", "do", "vu", "dine", "ox", "cy", "glu", "ta", "thi", "one", "nap", "qi"]
    word = lambda: "".join(random.choice(syllables) for _ in range(random.randint(2, 4)))
    types = ["drug", "disease", "enzyme", "receptor", "protein", "pathogen", "organ", "concept"]
    rel_types = ["TREATS", "INHIBITS", "ACTIVATES", "TARGETS", "METABOLIZED_BY", "ASSOCIATED_WITH", "CAUSES", "IS_A"]

    print(f"Building {n_entities:,} entities, {n_relationships:,} relationships in {tmp} …")
    start = time.perf_counter()
    t = now()
    ids = [new_id() for _ in range(n_entities)]
    hub = ids[0]  # one very connected entity, like Paracetamol in a big knowledge base
    with transaction(conn):
        conn.executemany("INSERT INTO entity (id, entity_type_id, name, description, status_code, created_at, updated_at) "
                         "VALUES (?, ?, ?, ?, 'proposed', ?, ?)",
                         [(i, random.choice(types), f"{word().capitalize()} {k}", f"{word()} {word()} {word()}", t, t)
                          for k, i in enumerate(ids)])
        conn.executemany("INSERT INTO entity_alias (id, entity_id, alias, created_at) VALUES (?, ?, ?, ?)",
                         [(new_id(), i, f"{word()}-{k}", t) for k, i in enumerate(ids)])
        conn.executemany("INSERT INTO knowledge_entry (id, entity_id, scope, section_id, body, status_code, created_at, "
                         "updated_at) VALUES (?, ?, 'general', 'mechanism', ?, 'proposed', ?, ?)",
                         [(new_id(), i, " ".join(word() for _ in range(40)), t, t) for i in ids])
        pairs = [(hub, random.choice(ids)) for _ in range(2_000)]
        pairs += [(random.choice(ids), random.choice(ids)) for _ in range(n_relationships - len(pairs))]
        conn.executemany("INSERT INTO relationship (id, source_entity_id, target_entity_id, relationship_type_id, "
                         "status_code, created_at, updated_at) VALUES (?, ?, ?, ?, 'proposed', ?, ?)",
                         [(new_id(), s, d, random.choice(rel_types), t, t) for s, d in pairs])
        conn.executescript((Path(__file__).parents[1] / "db" / "migrations" / "003_fill_search_index.sql").read_text())
    print(f"  built in {time.perf_counter() - start:.1f} s, database {config.db_path().stat().st_size / 1e6:.0f} MB\n")

    def timed(label, run, repeat=5):
        times = []
        for _ in range(repeat):
            s = time.perf_counter()
            result = run()
            times.append((time.perf_counter() - s) * 1000)
        print(f"  {label:<58} {min(times):8.1f} ms (best of {repeat}), {sum(times) / len(times):8.1f} ms avg")
        return result

    typical = ids[1234]
    first = timed("Graph: expand hub entity (2,000+ neighbours), first 25", lambda: graph.expand(conn, hub, []))
    visible = [hub] + [n["id"] for n in first["neighbors"]]
    timed("Graph: expand a typical entity", lambda: graph.expand(conn, typical, []))
    timed("Graph: links + hidden counts for 26 visible nodes", lambda: graph.view(conn, visible))
    timed("Graph: links + hidden counts for 300 visible nodes", lambda: graph.view(conn, random.sample(ids, 300)))
    timed("Search: 5-letter piece of a name", lambda: search.search(conn, "ratam"))
    timed("Search: two words", lambda: search.search(conn, "cemol glu"))
    timed("Search: 2-character query (scan fallback)", lambda: search.search(conn, "qi"), repeat=3)
    timed("Entity page: knowledge entries", lambda: entries.list_entries(conn, typical))
    timed("Entity page: relationships of the hub (2,000+)", lambda: relationships.list_for_entity(conn, hub), repeat=3)
    conn.close()
    made = timed("Backup: create + validate whole database", lambda: backup.create_backup("manual"), repeat=1)
    timed("Restore: validate + safety backup + restore", lambda: backup.restore_backup(made["name"]), repeat=1)
    print(f"\nTemporary folder (safe to delete): {tmp}")


if __name__ == "__main__":
    main(*(int(a) for a in sys.argv[1:3]))
