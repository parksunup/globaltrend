# Collector coverage review for completed listing scans

Run reviewed: GitHub Actions run `43382161594`, 2026-11-13.

The collector currently ends the ordinary `collect()` path by setting
`coverage_complete=false` and `status=partial`, even when it reaches the last
listing page and reports no unknown dates, failed details, or excluded hosts.
That makes the status overly broad. However, `listing_scan_complete` proves
only that the adapter reached the end of its observed listing route. It does
not prove that the route represents every publication in the requested date
window.

## Candidate cohort

The candidate set inferred from the run summary is EDPB, CURIA, CNIL, DPC,
EDPS, CA-OPC, CN-TC260, NPC-PH, FPF, Global CBPR, and NL-AP. Before changing
status logic, compare this list with the per-source JSON payload from the run;
the summary output groups several sources under one reason and does not carry
the evidence needed to certify date-window coverage.

## Known coverage limitations

- CNIL's `cnil_listing_date()` documents that a card date may exclude an
  individually dated item but does not prove archive ordering.
- NL-AP uses a rolling RSS feed. The source catalog says its ten-item feed has
  no continuation and that coverage is incomplete.
- Global CBPR's observed listing had twelve candidates and no next-page link.
  The source catalog explicitly says pagination is incomplete.
- EDPS is deferred by source permissions and held. Its RSS route is not
  evidence of an enabled date-bounded archive.
- The run's `listing_scan_complete` flag does not include a dated boundary
  observation, server-side range, total-count check, or source-specific
  archive proof for the other candidates.

## Required evidence before marking a source complete

Add an explicit per-source coverage strategy only after verifying it against
the official route. Acceptable evidence includes a server-side bounded date
query whose parameters are reflected in the request and response, a complete
date archive enumerated through both endpoints of the requested interval, or
a documented newest-first listing where the collector observes a valid item
older than `since` and verifies all dates in the traversed sequence. Persist
the strategy and boundary observation in the run result. Then permit
`status=complete` only when listing traversal ended and there are no unresolved
dates, failed details, excluded items, or permission holds.

Until this evidence exists, these runs should remain `partial`. A zero-item
period can be called complete only when the same route-level coverage proof
shows that the date interval was fully examined.
