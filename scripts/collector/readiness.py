"""Shared technical readiness metadata, independent of editorial decisions."""


def mark_ai_readiness(item):
    """Mark whether title/body text can enter Korean drafting.

    This flag does not assert privacy relevance, significance, date certainty,
    source approval, factual correctness, human review, or publication approval.
    """
    metadata = item.setdefault('metadata', {})
    title = item.get('title_original')
    body = item.get('content_text')
    usable = (
        isinstance(title, str) and bool(title.strip())
        and isinstance(body, str) and 10 <= len(body.strip()) <= 80000
    )
    metadata['ai_ready'] = usable
    metadata['draft_readiness_reason'] = (
        'usable_title_and_source_text' if usable else 'missing_or_unusable_title_or_source_text'
    )
    return item
