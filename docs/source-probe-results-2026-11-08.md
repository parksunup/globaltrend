# 2026-11-08 live probe: all requested sources

The probe attempted every one of the 36 unique catalog entries using the pinned Crawlee HTTP crawler and Trafilatura-first body extraction. It made no database writes. After removing the arbitrary 100-character extraction threshold, 19 sources returned a listing candidate with non-empty extracted text and 17 failed at the recorded stage. This is a transport/extraction smoke test only: it does not establish privacy-topic relevance, date correctness, pagination completeness, or readiness for scheduled collection. The observed HTTP errors are not treated as permanent source denial.

| ID | Cohort | Probe result | Sample candidate / observed failure |
|---|---|---|---|
| edpb | original-19 | listing_and_body_extracted | EDPB helps kids stay safe online (1324 body characters; topic/date still need review) |
| oecd | original-19 | failed | http_403 |
| curia | original-19 | listing_and_body_extracted | Judgment of the Court in Case C-395/25 Orkla Care (6594 body characters; topic/date still need review) |
| cnil | original-19 | listing_and_body_extracted | Recherches internes : quelles sont les obligations pour les professionnels de santé ? (4881 body characters; topic/date still need review) |
| ico | original-19 | failed | http_400 |
| dpc | original-19 | listing_and_body_extracted | Data Protection Commission Publishes Final Decision Following Inquiry into the Children’s Health Ireland (‘CHI’) (3694 body characters; topic/date still need review) |
| pdpc | original-19 | listing_and_body_extracted | Advisory for Data Protection Risks When Using Unauthorised AI Tools For the Development of Software or Scripts (298 body characters; topic/date still need review) |
| ppc | original-19 | listing_and_body_extracted | 行政機関等の個人情報保護制度の在り方に関する研究会の開催について （令和８年10月28日） (2037 body characters; topic/date still need review) |
| ftc | original-19 | failed | http_403 |
| ec | original-19 | failed | no_detail_candidate_parsed |
| calprivacy | original-19 | failed | http_403 |
| oaic | original-19 | listing_and_body_extracted | OAIC closes preliminary inquiries into VIQ Solutions (2586 body characters; topic/date still need review) |
| ca-opc | original-19 | listing_and_body_extracted | Completed 2025-2026 Contributions Program projects reveal insights related to personal information collection by smart devices (1386 body characters; topic/date still need review) |
| hk-pcpd | original-19 | listing_and_body_extracted | SEE to attend COP31 in Türkiye (798 body characters; topic/date still need review) |
| eu-parliament | original-19 | failed | http_403 |
| eu-council | original-19 | failed | http_403 |
| cn-cac | original-19 | failed | http_403 |
| cn-tc260 | original-19 | listing_and_body_extracted | 关于下达25项网络安全推荐性国家标准计划的通知 (279 body characters; topic/date still need review) |
| es-aepd | original-19 | failed | listing_fetched_but_no_relevant_article_candidates |
| edps | additional-12 | failed | listing_fetched_but_no_relevant_article_candidates |
| anpd-br | additional-12 | failed | listing_fetched_but_no_relevant_article_candidates |
| npc-ph | additional-12 | failed | http_403 |
| jpdp-my | additional-12 | listing_and_body_extracted | PUBLIC CONSULTATION PAPER NO. 1/2026 : ARTIFICIAL INTELLIGENCE (AI) AND PERSONAL DATA PROTECTION FRAMEWORK (397 body characters; topic/date still need review) |
| nist | additional-12 | failed | listing_fetched_but_no_relevant_article_candidates |
| iapp | additional-12 | listing_and_body_extracted | A view from DC: How to read policy tea leaves (10903 body characters; topic/date still need review) |
| fpf | additional-12 | listing_and_body_extracted | FPF Member Training FAQs (1492 body characters; topic/date still need review) |
| gpa | additional-12 | listing_and_body_extracted | Global Privacy Assembly welcomes its new GPA Reference Panel members (2858 body characters; topic/date still need review) |
| g7-dpa | additional-12 | listing_and_body_extracted | CNIL : Formulaire de recherche (571 body characters; topic/date still need review) |
| global-cbpr | additional-12 | listing_and_body_extracted | The Forum Releases its Annual Report 2025/2026 and Annual Work Program for 2026/2027 (316 body characters; topic/date still need review) |
| ripd | additional-12 | failed | robots_fetch_failed:http_503 |
| iso-iec-sc27 | additional-12 | failed | no_detail_candidate_parsed |
| noyb | additional-source | listing_and_body_extracted | 29.10.2026 Online & Mobile tracking noyb win: French electronics retailer Fnac Darty fined €7 million The fine is based on a noyb complaint from 2023. Back then, we highlighted that Fnac Darty illegally tracked users of its mobile apps without consent Read more (2444 body characters; topic/date still need review) |
| nl-ap | additional-source | failed | no_detail_candidate_parsed |
| vn-gov | additional-source | failed | listing_fetched_but_no_relevant_article_candidates |
| freevacy | additional-source | listing_and_body_extracted | CSR Bill amendment grants ministers powers to investigate rogue AI agents (2793 body characters; topic/date still need review) |
| overview-legal | additional-source | listing_and_body_extracted | Personal Data 179 (10508 body characters; topic/date still need review) |
| eur-lex | previously-tested-held | failed | **2026-11-09 recheck:** official listing returned HTTP 202, `text/html`, 0 response bytes, 0 candidates; user hold preserved |

## Interpretation

- Every catalog entry was attempted in this run; none was omitted from the table.
- `listing_and_body_extracted` means one listing candidate returned a non-empty extracted body. It is not evidence that the candidate is on-topic or a full article. Several are visibly generic, off-topic, or too short and do not count as qualified privacy-news coverage.
- HTTP 403/400, temporary robots response, and candidate parsing failures are distinct observed outcomes. The probe does not attempt access-control bypass.
- A later operational onboarding must separately verify source-specific topic relevance, publication-date evidence, feed/list pagination, and durable retry behavior.

## Subsequent route-level checks

The initial row above is a 2026-11-08 catalog smoke probe. It must not be read as
the final status of a route that was later adapted and tested. Later checks are
recorded separately with the actual URLs and evidence below. The complete scope
is now **37 unique IDs**, including EUR-Lex, which already existed as a held
source in the runtime registry and previous phase document. EUR-Lex's hold was
not removed.

| Source | Listing URL tried | Detail URL tried | Result and evidence |
|---|---|---|---|
| EUR-Lex | https://eur-lex.europa.eu/content/news/index.html | Not reached | Crawlee HTTP crawler returned HTTP 202, final URL unchanged, `text/html`, 0 bytes, 0 candidates, one request. It remains `held_by_user` (`user_deferred_2026_10_29`). |
| NIST / NCCoE | https://www.nist.gov/news-events/news-updates/org/258376 | https://www.nist.gov/news-events/news/2026/10/privacy-preserving-federated-learning-ppfl-testbed-and-curated-dataset | Production `HttpClient` + Trafilatura-first path found 25 listing rows and continuation, matched the official privacy-relevant item with listing/detail date agreement (2026-10-29), and extracted 2,050 characters from the detail page. Robots check allowed the requested path. Official NIST copyright/disclaimer page says NIST web pages are a public service and unmarked information may be copied/distributed; preserve attribution and verify page-level markings. |

## Official alternate-route check

The following additional routes were fetched through the same Crawlee probe, without bypass behavior:

| Route | Observed result | Interpretation |
|---|---|---|
| Council of the EU press-release RSS (`/en/rss/pressreleases.ashx`) | HTTP 200, `text/xml`, 20 items parsed | Transport and feed parsing work. The feed is broad and needs topic filtering and full-period pagination validation. |
| Netherlands AP RSS (`/feed/article/rss.xml`, reached from `/nl/rss`) | HTTP 200, `application/rss+xml`, 10 items parsed | Official feed route works; sample includes relevant privacy items. A relevant detail page and date evidence still need to be validated. |
| NIST RSS directory | HTTP 200, 95 links parsed | This is a directory, not an article feed. Select a privacy-specific official feed and test it before onboarding. |
| ANPD listing with literal `b_start:int=0` | HTTP 200, zero candidate links | The previous URL-encoding hypothesis did not resolve extraction; a source-specific listing parser or different official view needs investigation. |
| EDPB suggested RSS, ICO/FTC RSS directories, CalPrivacy feed, European Parliament feed, EDPS site feed, NPC press-release page | 404 for EDPB RSS; 403 for the others in this environment | Suggestions are not treated as working alternatives. Recorded as observed route results; failures are not interpreted as global non-access. |

## Follow-up routes and EDPS full-post validation

Follow-up checks used the same pinned Crawlee client and did not bypass site
controls. The outcomes below separate listing access from article-body proof.

| Source | Route tested | Observation | What it proves / does not prove |
|---|---|---|---|
| EDPS | Official Mastodon RSS `https://social.edps.europa.eu/@EDPS.rss` | HTTP 200, `application/rss+xml`, 20 items; item has no `<title>` but has a linked status, HTML `<description>`, and timezone-qualified `<pubDate>`. The updated parser extracted one complete 895-character post and `2026-11-08` from the feed. | The official RSS itself supplies a usable full post; no separate status-page body is needed for this route. The 20 items are not all independently relevance-reviewed, and feed pagination/history completeness is not established. Production registration remains disabled pending its existing source-approval gate. |
| EU Council | Official press-release RSS `https://www.consilium.europa.eu/en/rss/pressreleases.ashx` | HTTP 200 XML, 20 entries. | Listing only. Privacy filtering, detail body, date provenance, and older-item continuation remain to validate. |
| Netherlands AP | Official RSS `https://autoriteitpersoonsgegevens.nl/feed/article/rss.xml` | HTTP 200 RSS, 10 entries; two privacy/AI-related candidate titles were found and their URLs are in the feed. | Candidate discovery only. Full body and publication-date verification remain to validate. |
| Philippines NPC | Official RSS `https://privacy.gov.ph/feed/` | HTTP 200 RSS, 9 entries; privacy-related candidate posts are present. | Candidate discovery only. Full body and publication-date verification remain to validate. |
| FTC | Official search page `https://search.ftc.gov/news-events/news/press-releases` | HTTP 200 HTML, 23 candidate links; top results included unrelated competition topics. The official FTC RSS tested separately returned HTTP 403. | Listing access only. It needs topic selection and detail-body checks; it is not a qualified replacement yet. |
| Spain AEPD | Official press page `https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa` | An independent Crawlee route check parsed 8 candidate links, while the catalog-probe path filtered to zero. | The two parser paths disagree. The cause and individual detail bodies must be checked before claiming coverage. |
| California CPPA | Legacy official `https://cppa.ca.gov/announcements/` | HTTP 200 with announcement links, but the page says current announcements moved to `privacy.ca.gov` in 2026; the current page returned HTTP 403 in the probe environment. | Historical republication only; not a complete current monitoring route. |
| OECD | Official newsroom alternative `https://www.oecd.org/en/about/newsroom.html` | HTTP 403 in the same environment. | No listing/body result from this route. This is an observed response, not a conclusion that every execution environment is denied. |
| Brazil ANPD | Official `https://www.gov.br/anpd/pt-br/assuntos/noticias` | HTTP 200 HTML but zero candidates from the generic parser. | Response received; listing extraction remains unresolved. |
| NIST | Official privacy-topic page | HTTP 200 and 25 links, but sampled candidates were cybersecurity news unrelated to the privacy topic. | Page availability only; source-specific topic selection is unresolved. |

The refreshed full-catalog result is `work/source-catalog-probe-2026-11-08-recheck.json`
and is generated locally; it is not committed as a runtime artifact. Its 19
non-empty bodies are **not** 19 qualified sources. A valid operational source
needs a relevant item, the complete intended source text, defensible date
evidence, and a continuation/retry strategy. EDPS is the follow-up source for
which the official feed body itself has been tested end to end.

## Full 36-source recheck after parser fixes — 2026-11-08

The full recheck used the pinned Crawlee 1.11.0 HTTP crawler and
Trafilatura 2.3.1, with robots rules checked before each page, host-level
request spacing, and no session rotation, proxy, CAPTCHA, or access-control
bypass. It was read-only. A same-host HTTP 401/403/429/5xx now stops further
detail requests to that host for the current source check; the output records
which candidate was attempted and which same-host candidates were skipped.
This avoids sending the same denied request repeatedly and does not classify a
404 or an extraction failure as a host-wide denial.

The 36-source inventory was attempted in full. “Text extracted” below means a
sample body was returned; it is only a smoke result. It does not certify that
the sample is privacy-related, current, complete, or that pagination is
complete. `signals=0` means the sample did not contain any of the probe's
known privacy terms; it is a review flag, not a definitive relevance test.

| Source | Result from this run | Sample body/date or observed failure |
|---|---|---|
| EDPB | Text extracted; needs relevance review | 1,324 chars; 2026-11-04; 3 privacy signals |
| OECD | Listing blocked | `http_403` |
| CJEU / CURIA | Text extracted; scope review required | 6,594 chars; 2026-11-05; official press-release PDF, not a judgment; 0 known signals |
| CNIL | Text extracted | 4,881 chars; 2026-11-06; 2 signals |
| ICO via WiredGov | Listing failed | `http_400` on the date-filtered WiredGov route |
| Ireland DPC | Text extracted, but sample is old | 3,694 chars; 2026-10-01; 3 signals |
| Singapore PDPC | Text extracted; very short sample | 298 chars; 2026-09-30; 1 signal |
| Japan PPC | Text extracted | 2,037 chars; 2026-10-28; 1 signal |
| FTC | Listing blocked by Crawlee | `http_403`; the official FTC privacy-tag page is visible through the web reader, but the crawler did not retrieve it |
| European Commission | Listing parsed, body not extracted | 10 candidates; first detail returned JSON that the generic HTML body extractor did not parse |
| California CPPA | Listing blocked | `http_403` |
| Australia OAIC | Text extracted | 2,586 chars; 2026-11-04; 1 signal |
| Canada OPC | Text extracted | 1,386 chars; 2026-11-06; 3 signals |
| Hong Kong PCPD / government republication | Text extracted; relevance review required | 1,789 chars; 2026-11-08; 0 known signals |
| European Parliament | Listing blocked | `http_403` |
| Council of the EU | RSS listing parsed; detail blocked | 20 entries; first detail `http_403`; remaining same-host details were not retried |
| China CAC | Listing blocked | `http_403` |
| China TC260 | Text extracted; relevance and date review required | 279 chars; 2026-10-13; 0 known signals |
| Spain AEPD | Text extracted after selector fix | 4,470 chars; 2026-11-05; 1 signal; actual card title and date now come from the teaser card |
| EDPS Mastodon RSS | Full RSS post extracted | 895 chars; 2026-11-08; `official_rss_item_full_post`; 1 signal |
| Brazil ANPD | Listing fetched, no article candidates | `listing_fetched_but_no_relevant_article_candidates` |
| Philippines NPC | RSS listing parsed; detail blocked | 9 entries; first detail `http_403`; same-host details were not retried |
| Malaysia PDP Commissioner | Text extracted; short sample | 397 chars; 2026-10-29; 2 signals |
| US NIST | Listing fetched, topic filter rejected candidates | 25 links, 0 candidates matched the configured privacy terms |
| IAPP | Text extracted; relevance review required | 10,903 chars; 2026-11-06; 1 signal |
| Future of Privacy Forum | Text extracted but sample is old/unrelated | 1,492 chars; 2014-06-05; 0 known signals |
| Global Privacy Assembly | Text extracted | 2,858 chars; 2026-11-03; 3 signals |
| G7 DPA Roundtable (CNIL page) | False positive detected | 571 chars; 2026-11-04; extracted CNIL search form, not a G7 item |
| Global CBPR Forum | Text extracted; relevance review required | 316 chars; 2026-06-10; 0 known signals |
| RIPD | Robots check unavailable | `robots_fetch_failed:http_503`; no listing request followed |
| ISO/IEC JTC 1/SC 27 | Listing parsed; PDF body not extracted | 44 links; first detail was `application/pdf`, unsupported by generic probe extraction |
| noyb | Text extracted | 2,444 chars; 2026-10-29; 2 signals |
| Netherlands AP | Official RSS parsed; detail path disallowed by robots | 10 entries; the feed descriptions are excerpts, not verified full articles |
| Vietnam Government Online Newspaper | Listing parsed, topic filter rejected candidates | 29 links, 0 candidates matched configured terms |
| Freevacy | Text extracted; relevance review required | 2,793 chars; 2026-11-05; 2 signals |
| overview.legal | Text extracted; relevance/source-type review required | 10,508 chars; 2026-11-05; 3 signals |

The probe returned a non-empty sample body for 21 of 36 IDs, but several are
demonstrable false positives or stale samples. Therefore the qualified-source
count is **not 21**. For this run, only EDPS and AEPD received a specific
follow-up that improved the source adapter; the other rows remain at the
observed result above. FTC's official topic archive is
[`FTC Press Releases by Tag`](https://www.ftc.gov/news-events/press-releases/terms/1424),
but it returned `http_403` to this Crawlee run. The `search.ftc.gov` alias
returned unrelated competition content and must not be used as a substitute.

The sample output is `work/source-catalog-probe-2026-11-08-final.json` and is
ignored local evidence, not a committed runtime artifact. The full run confirms
the parser/transport probe exercised all 36 catalog entries; it does **not**
prove all 36 are integrated into the durable Supabase queue or ready for
scheduled production collection. The production registry still contains 21
entries, and its cloud-Python SQL route remains a separate allowlist. Those
integration gaps remain part of the active build goal.
