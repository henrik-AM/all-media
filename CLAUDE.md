## Zwei KIs

Claude und Codex arbeiten beide an All Media. `H` = `~/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik`
(gilt auch in Worktrees außerhalb davon). Codex beginnt sein Projekt hier an der Git-Wurzel
und liest `H/AGENTS.md` deshalb nicht von selbst: zuerst `H/AGENTS.md` lesen, dann
`bash H/Claude/Uebergabe/ki-abgleich.sh start <ki>`. Verbindlich:
`H/2.Gehirn.md/04 Ressourcen/KI-Zusammenarbeit/Zusammenarbeit.md`. Prüfläufe gegen Supabase
nur nach `ki-abgleich.sh belegen <ki> testbestand "<zweck>"`, sonst Abbruch mit Code 2.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
