import { loadPublishedStories, type PublishedStory } from './published-trends';
import { loadPublishedLegalForSearch } from './public-legal';
import type { LegalBundle } from './legal-release';
import type { SearchDocument } from './unified-search';
function https(value: string): string { try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
}
catch {
    return '';
} }
export function publicSearchDocuments(stories: PublishedStory[], legal: LegalBundle): SearchDocument[] {
    const documents: SearchDocument[] = stories.filter(story => story.publicationStatus === 'published').map(story => ({
        id: `trend:${story.id}`, kind: 'trend', title: story.title, text: [story.summary, story.details].filter(Boolean).join('\n\n'),
        url: `/public/trends/${encodeURIComponent(story.id)}`, jurisdictions: story.jurisdictions ?? [story.country], tags: [...story.tags, story.originalTitle, story.institution],
        date: /^\d{4}\.\d{2}(?:\.\d{2})?$/.test(story.date) ? story.date.replaceAll('.', '-') : '', version: '', sourceUrl: https(story.officialUrl),
    }));
    for (const cell of legal.cells) {
        if (cell.status !== 'published' || !cell.summary.trim())
            continue;
        documents.push({ id: `comparison:${cell.id}`, kind: 'comparison', title: cell.criterionName, text: [cell.summary, cell.exceptions ? `조건·예외: ${cell.exceptions}` : ''].filter(Boolean).join('\n\n'),
            url: `/public/laws?${new URLSearchParams({ view: 'compare', countries: cell.jurisdiction, criterion: cell.criterionId, published: '1' })}`, jurisdictions: [cell.jurisdiction], tags: [cell.criterionName, ...cell.articleNumbers], date: '', version: cell.sourceVersion, sourceUrl: https(cell.sourceUrl), criterionId: cell.criterionId });
    }
    for (const law of legal.documents) {
        if (!['published', 'official'].includes(law.reviewStatus) || !/^[a-z0-9-]+$/.test(law.id))
            continue;
        for (const section of law.sections) {
            const text = section.lines.map(line => line.text).filter(Boolean).join('\n');
            if (!text.trim())
                continue;
            documents.push({ id: `article:${law.id}:${section.id}`, kind: 'article', title: section.title, text: [section.context, text].filter(Boolean).join('\n'), url: `/public/laws/${law.id}?published=1#${encodeURIComponent(section.id)}`,
                jurisdictions: [law.jurisdiction], tags: [law.title, law.officialName, section.context], date: '', version: law.version, sourceUrl: https(law.officialUrl), lawId: law.id, lawTitle: law.title });
        }
    }
    return [...new Map(documents.map(document => [document.id, document])).values()];
}
export async function loadPublicSearchCorpus() {
    const [trends, laws] = await Promise.allSettled([loadPublishedStories(), loadPublishedLegalForSearch()]);
    return { documents: publicSearchDocuments(trends.status === 'fulfilled' ? trends.value : [], laws.status === 'fulfilled' ? laws.value : { cells: [], documents: [], instruments: [] }),
        sources: { trends: trends.status === 'fulfilled', laws: laws.status === 'fulfilled' } };
}
