# Complete 36-source live probe (2026-11-09)

The source list is the full eligible inventory reconciled from the conversation and repository: the original 19, 12 additional candidates, and 5 subsequently added sources (noyb, NL AP, Vietnam Government Online Newspaper, Freevacy, overview.legal). EUR-Lex was held by the user and not requested. RD Privacy Watch was excluded by the user.

Each source was probed sequentially in its own Python process using the repository Crawlee + Trafilatura-first probe. This avoids sharing Crawlee process state between unrelated source requests. The probe performs no database writes. A successful sample means that a listing candidate and some body text were extracted; it does not establish that all pagination was exhausted or that the sample was privacy-relevant. Those checks remain human-review items.

Result: **28 of 36 sources produced a listing and body sample; 8 did not.** Full per-source JSON, including URLs, extracted-text evidence, dates, errors, and process timestamps, is in [`docs/evidence/source-catalog-probe-36-current-2026-11-09.json`](evidence/source-catalog-probe-36-current-2026-11-09.json).

| ID | Result | Observed evidence / failure |
|---|---|---|
| edpb | listing_and_body_extracted | 본문 1324자; trafilatura; EDPB helps kids stay safe online |
| oecd | failed | listing_fetch: http_403 |
| curia | listing_and_body_extracted | 본문 6594자; source_specific_adapter_fallback; Judgment of the Court in Case C-395/25 Orkla Care |
| cnil | listing_and_body_extracted | 본문 4881자; trafilatura; Recherches internes : quelles sont les obligations pour les professionnels de santé ? |
| ico | listing_and_body_extracted | 본문 5143자; trafilatura; WIRED GOV |
| dpc | listing_and_body_extracted | 본문 3694자; trafilatura; Data Protection Commission Publishes Final Decision Following Inquiry into the Children’s Health Ireland (‘CHI’) |
| pdpc | listing_and_body_extracted | 본문 20자; trafilatura; Advisory for Data Protection Risks When Using Unauthorised AI Tools For the Development of Software or Scripts |
| ppc | listing_and_body_extracted | 본문 56자; trafilatura; 行政機関等の個人情報保護制度の在り方に関する研究会の開催について（令和８年10月28日） |
| ftc | failed | listing_fetch: robots_disallowed |
| ec | listing_and_body_extracted | 본문 6847자; trafilatura; Speech by Commissioner Hoekstra at the 22nd Athens Tax Forum |
| calprivacy | failed | listing_fetch: http_403 |
| oaic | listing_and_body_extracted | 본문 2586자; trafilatura; OAIC closes preliminary inquiries into VIQ Solutions |
| ca-opc | listing_and_body_extracted | 본문 1386자; trafilatura; News release: Completed 2025-2026 Contributions Program projects reveal insights related to personal information collection by smart devices |
| hk-pcpd | failed | listing_or_detail_parse: listing_fetched_but_no_relevant_article_candidates (HTTP 200) |
| eu-parliament | failed | listing_fetch: http_403 |
| eu-council | listing_and_body_extracted | 본문 106자; official_rss_description_or_summary; Informal meeting of Heads of State or Government of 13 November 2026 - Invitation letter by President António Costa to the members of the European Council |
| cn-cac | failed | listing_fetch: http_403 |
| cn-tc260 | listing_and_body_extracted | 본문 262자; trafilatura; 关于下达25项网络安全推荐性国家标准计划的通知 |
| es-aepd | listing_and_body_extracted | 본문 4470자; trafilatura; La AEPD y la Autoridad helénica de protección de datos publican una guía conjunta sobre entornos de tratamiento seguro |
| edps | listing_and_body_extracted | 본문 895자; official_mastodon_rss_description; Datapedia : Automated proctoring |
| anpd-br | listing_and_body_extracted | 본문 4421자; source_specific_adapter_fallback; Brasil e Reino Unido avançam no diálogo sobre arranjos para transferências internacionais de dados |
| npc-ph | listing_and_body_extracted | 본문 2099자; rss_content_encoded; STATEMENT OF THE NATIONAL PRIVACY COMMISSION ON REPORTED DATA LEAKS INVOLVING GOVERNMENT AGENCIES |
| jpdp-my | listing_and_body_extracted | 본문 68612자; trafilatura_attempt_then_pypdf; PUBLIC CONSULTATION PAPER NO. 1/2026 : ARTIFICIAL INTELLIGENCE (AI) AND PERSONAL DATA PROTECTION FRAMEWORK |
| g7-dpa | listing_and_body_extracted | 본문 6809자; trafilatura; Communiqué: G7 Data Protection and privacy Authorities Roundtable |
| nist | listing_and_body_extracted | 본문 2050자; trafilatura; Privacy-Preserving Federated Learning (PPFL) Testbed and Curated Dataset |
| iapp | listing_and_body_extracted | 본문 10340자; trafilatura; A view from DC: How to read policy tea leaves |
| fpf | listing_and_body_extracted | 본문 11086자; trafilatura; Bridging State Aging Plans and AgeTech Development |
| gpa | listing_and_body_extracted | 본문 2858자; trafilatura; Global Privacy Assembly welcomes its new GPA Reference Panel members |
| global-cbpr | listing_and_body_extracted | 본문 7031자; trafilatura_attempt_then_pypdf; The Forum Releases its Annual Report 2025/2026 and Annual Work Program for 2026/2027 |
| ripd | failed | listing_fetch: http_503 |
| iso-iec-sc27 | listing_and_body_extracted | 본문 2081자; pypdf; ISO/IEC TS 27560-2023 now freely available |
| noyb | listing_and_body_extracted | 본문 2444자; trafilatura; noyb win: French electronics retailer Fnac Darty fined €7 million |
| nl-ap | listing_and_body_extracted | 본문 944자; trafilatura; Handhavingsbeleid AP gepubliceerd |
| vn-gov | failed | listing_or_detail_parse: listing_fetched_but_no_relevant_article_candidates |
| freevacy | listing_and_body_extracted | 본문 2793자; trafilatura; CSR Bill amendment grants ministers powers to investigate rogue AI agents |
| overview-legal | listing_and_body_extracted | 본문 35499자; trafilatura; NSA: Controller's use of employee's Facebook messages violated GDPR Articles 5, 6 and 9 |

## Interpretation

- `listing_and_body_extracted` means one route and sample were extracted; it is not a full-corpus guarantee. Pagination, topic relevance, date confidence, and drafting suitability remain separate checks.
- OECD returned HTTP 403 on the tested topic page. An earlier official RSS response existed but did not yield a privacy-relevant sample; it is not counted as body coverage.
- FTC was stopped before a network request by its explicit robots policy (`robots_disallowed`).
- PCPD official date archives returned HTTP 200 but no privacy-related candidate appeared in the three-day probe window.
- Vietnam official policies index and homepage both returned content, but current candidates did not match the privacy-topic filter.
- RIPD returned HTTP 503 in this run; an earlier 200 response suggests a transient failure.
- PPC official article routes add a canonical trailing slash. The identity check now accepts only that exact path variation; the rerun extracted a sample.
- Global CBPR exposed uninitialized per-candidate extraction metadata. After initialization, the rerun extracted 7,031 characters from the official article and linked documents.
- The remaining 403 results (California CPPA, European Parliament RSS, China CAC) are endpoint responses observed in this run, not proof that every official route is unavailable. No access-control bypass was attempted.
