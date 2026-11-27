# SSA Filing Bench

A deterministic bench for adult and child Social Security disability filings. It reads a submission the way the sequential evaluation reads evidence, quotes the loaded regulations, and drafts the strongest honest version of the same facts.

`filingStrength` is this bench's 0–100 index of whether the filing contains the facts the rules require. It is not an SSA score and it is not an approval probability. `sequential.outcome` is what those rules do with the facts the text actually establishes.

The bench will not invent a diagnosis, a test, a measurement, or a limitation. Gap lines in the draft are blanks.

## Regulations on disk

The corpus is the eCFR title 20 issue dated 2026-11-19 (20 CFR Part 404 and Part 416 disability sections, Appendix 1 listings, and Appendix 2), POMS DI 24503.025, DI 24503.030, and DI 25001.001, and the substantial-gainful-activity table documented in `corpus/sga.json`. Government works are public domain.

Regenerate only when `/tmp/ssa-src` still holds the source XML:

```bash
npm run corpus
```

## Web bench

```bash
cd ssa-filing-studio
npm install
npm test
npm start
```

Open http://localhost:8787. Paste a filing or use a sample, then choose **Weigh this filing**. The page leads with the sequential outcome, then the index, the sentence ledger, the factor quotes, the draft, and the audit.

If `npm run self-test` fails, the server answers `POST /api/grade` with 503 and does not return a grade.

## MCP

The same engine is an MCP server on stdio. Logs go to stderr. Register it with the working directory set to `ssa-filing-studio`:

```json
{
  "mcpServers": {
    "ssa-filing-bench": {
      "command": "npx",
      "args": ["tsx", "src/mcp.ts"]
    }
  }
}
```

A model should use it in this order:

1. `how_to_use`, or read the `ssa://guide` resource.
2. `quote_authority` or `search_authorities` before stating what a rule says.
3. `grade_filing` on the client's words. Lead with `sequential.outcome`. If `reliable` is false, show the audit and do not present the index as a grade.
4. `weigh_sentences` when the question is what a single sentence is legally competent to prove.
5. `get_listing`, `get_sga_amount`, `get_grid_rule`, `list_grid_rules`, and `apply_vocational_rule` for a specific authority or a hypothetical whose findings are already established.
6. `draft_strongest_filing` for the reorganized filing and the blanks.
7. `compare_filings` on every rewrite. If `novelNumbers` or `inventedClinicalMarkers` is not empty, the rewrite added facts and must not be used.
8. `self_test` if a result looks inconsistent.

`flag_invented_facts` checks a rewrite without grading it. `list_authorities` shows what the corpus contains. Prompts `review-filing`, `strengthen-filing`, and `explain-rule` encode that sequence.

Do not tell a client they will be approved, awarded, or denied by SSA. Say what this bench found and cite the authority.

## Outside projects that were reviewed

GitHub was searched for an evaluation engine that could be used inside this bench.

- `SSAgov` publishes operational tools (ERE, Health IT, accessibility). None of them is a sequential-evaluation engine, so none was imported.
- `SanjayS45/Claimd` is an application copilot with no license. Its code was not copied.
- `leipold-us/ssa-disability-ea-skills` is MIT-licensed architect notes. It was used as a checklist only. The rules below were checked against the regulations already in this corpus, and that repository's simplified exertional definitions were not adopted: a chiropractor is not an acceptable medical source (20 CFR 404.1502(a)); a statement that an impairment equals a listing is not medical equivalence (20 CFR 404.1526); work of fewer than thirty days is not past relevant work; a combination of mild impairments is not denied as non-severe until the combined effect is addressed (20 CFR 404.1523); a child whose filing describes no work is not stopped at step 1 for silence.
