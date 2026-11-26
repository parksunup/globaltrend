"""Shared technical readiness metadata, independent of editorial decisions."""


def mark_ai_readiness(item):
    """Mark whether a source has a usable title and body for drafting."""
    metadata = item.setdefault('metadata', {})
    title = item.get('title_original')
    body = item.get('content_text')
    usable = (
        isinstance(title, str) and bool(title.strip())
        and isinstance(body, str) and bool(body.strip())
    )
    metadata['ai_ready'] = usable
    metadata['draft_readiness_reason'] = (
        'usable_title_and_source_text'
        if usable else 'missing_or_unusable_title_or_source_text'
    )
    return item
