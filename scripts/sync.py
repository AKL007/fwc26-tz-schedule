#!/usr/bin/env python3
"""Sync FIFA WC 2026 match data from football-data.org into data/matches.json.

Merges API data with existing data, preserving fields (like venue) that
the API may not yet provide.
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

API_BASE = 'https://api.football-data.org/v4'
COMPETITION = 'WC'

def fetch(path, api_key):
    url = f'{API_BASE}{path}'
    req = urllib.request.Request(url, headers={'X-Auth-Token': api_key})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def normalize_team(team):
    if not team or not team.get('name'):
        return 'TBD'
    return team['name']

def normalize_stage(stage):
    mapping = {
        'GROUP_STAGE': 'GROUP_STAGE',
        'LAST_32': 'ROUND_OF_32',
        'LAST_16': 'ROUND_OF_16',
        'QUARTER_FINALS': 'QUARTER_FINAL',
        'SEMI_FINALS': 'SEMI_FINAL',
        'THIRD_PLACE': 'THIRD_PLACE',
        'FINAL': 'FINAL',
    }
    return mapping.get(stage, stage)

def load_existing(path):
    """Load existing matches keyed by (utcDate, stage, group, matchday) for merging."""
    try:
        with open(path) as f:
            data = json.load(f)
        lookup = {}
        for m in data.get('matches', []):
            key = (m['utcDate'], m.get('stage'), m.get('group'), m.get('matchday'))
            lookup[key] = m
        return lookup
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def main():
    api_key = os.environ.get('FOOTBALL_DATA_API_KEY')
    if not api_key:
        print('Error: FOOTBALL_DATA_API_KEY env var not set', file=sys.stderr)
        sys.exit(1)

    out_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'matches.json')
    existing = load_existing(out_path)

    print('Fetching matches from football-data.org...')
    data = fetch(f'/competitions/{COMPETITION}/matches', api_key)

    matches = []
    for m in data.get('matches', []):
        home = m.get('homeTeam', {})
        away = m.get('awayTeam', {})
        score = m.get('score', {})
        ft = score.get('fullTime', {})

        stage = normalize_stage(m.get('stage', ''))
        group = m.get('group')
        matchday = m.get('matchday')
        utc_date = m['utcDate']

        # Get venue from API, fall back to existing data
        venue = m.get('venue', '') or ''
        if not venue:
            key = (utc_date, stage, group, matchday)
            prev = existing.get(key, {})
            venue = prev.get('venue', '')

        matches.append({
            'id': m['id'],
            'utcDate': utc_date,
            'stage': stage,
            'group': group,
            'matchday': matchday,
            'homeTeam': normalize_team(home),
            'awayTeam': normalize_team(away),
            'venue': venue,
            'score': {
                'home': ft.get('home'),
                'away': ft.get('away'),
            },
            'status': m.get('status', 'SCHEDULED'),
        })

    output = {
        'lastUpdated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'matches': matches,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f'Wrote {len(matches)} matches to {out_path}')

if __name__ == '__main__':
    main()
