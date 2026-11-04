"""Decode SQL connector data without mistaking explanatory text for JSON.

This module never executes returned text. Save the original response before use.
"""
import json
import re


def decode_rows(response):
    if response.get('isError'):
        raise ValueError('connector_returned_error')
    blocks = response.get('content', [])
    for block in blocks:
        if block.get('type') != 'text':
            continue
        try:
            envelope = json.loads(block['text'])
        except (ValueError, TypeError):
            continue
        result = envelope.get('result') if isinstance(envelope, dict) else None
        if not isinstance(result, str):
            continue
        # The preamble also mentions the opening marker. Only a standalone
        # marker line delimits data; do not match its occurrence in prose.
        match = re.search(r'^<untrusted-data-([^>\r\n]+)>\r?\n([\s\S]*?)\r?\n</untrusted-data-\1>\s*$', result, re.MULTILINE)
        if match:
            rows = json.loads(match.group(2))
            if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
                raise ValueError('connector_rows_invalid')
            return rows
    raise ValueError('connector_response_envelope_unrecognized')


def main():
    import argparse
    import os
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--response', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    rows = decode_rows(json.loads(Path(args.response).read_text()))
    target = Path(args.out)
    # Atomic checkpoint: a failed decode never overwrites an earlier checkpoint.
    temporary = target.with_name(target.name + '.pending')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(rows, stream, ensure_ascii=False)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, target)
    print(json.dumps({'rows': len(rows), 'checkpoint_saved': True}))


if __name__ == '__main__':
    main()
