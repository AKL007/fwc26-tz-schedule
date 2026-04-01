#!/usr/bin/env python3
"""Fetch OpenFootball WC2026 data and normalize into data/matches.json."""

import json
import os
import re
import urllib.request
from datetime import datetime, timedelta, timezone

SOURCE_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

def parse_time(date_str, time_str):
    """Convert "2026-06-11" + "13:00 UTC-6" → UTC ISO string."""
    parts = time_str.split()
    time_part = parts[0]
    hours, minutes = map(int, time_part.split(':'))

    offset_hours = 0
    if len(parts) > 1:
        m = re.match(r'UTC([+-]\d+)', parts[1])
        if m:
            offset_hours = int(m.group(1))

    # Local time in that offset → convert to UTC
    local_dt = datetime(
        *map(int, date_str.split('-')),
        hours, minutes,
        tzinfo=timezone(timedelta(hours=offset_hours))
    )
    utc_dt = local_dt.astimezone(timezone.utc)
    return utc_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

STAGE_MAP = {
    'Round of 32': 'ROUND_OF_32',
    'Round of 16': 'ROUND_OF_16',
    'Quarter-final': 'QUARTER_FINAL',
    'Quarter-finals': 'QUARTER_FINAL',
    'Semi-final': 'SEMI_FINAL',
    'Semi-finals': 'SEMI_FINAL',
    'Third-place match': 'THIRD_PLACE',
    'Third place': 'THIRD_PLACE',
    'Final': 'FINAL',
}

def normalize_stage(round_name):
    if round_name.startswith('Matchday'):
        return 'GROUP_STAGE'
    return STAGE_MAP.get(round_name, re.sub(r'[\s-]+', '_', round_name.upper()))

def normalize_team(team):
    if not team:
        return 'TBD'
    if re.match(r'^\d[A-L]$', team):
        pos = '1st' if team[0] == '1' else '2nd' if team[0] == '2' else f'{team[0]}th'
        return f'{pos} Group {team[1]}'
    if re.match(r'^W\d+$', team):
        return f'Winner Match {team[1:]}'
    if re.match(r'^L\d+$', team):
        return f'Loser Match {team[1:]}'
    return team

def main():
    print(f'Fetching from {SOURCE_URL}...')
    with urllib.request.urlopen(SOURCE_URL) as resp:
        data = json.loads(resp.read().decode())

    matches = []
    for i, m in enumerate(data['matches']):
        round_name = m.get('round', '')
        matches.append({
            'id': m.get('num', i + 1),
            'utcDate': parse_time(m['date'], m['time']),
            'stage': normalize_stage(round_name),
            'group': m.get('group'),
            'matchday': int(round_name.replace('Matchday ', '')) if round_name.startswith('Matchday') else None,
            'homeTeam': normalize_team(m.get('team1')),
            'awayTeam': normalize_team(m.get('team2')),
            'venue': m.get('ground', ''),
            'score': {'home': None, 'away': None},
            'status': 'SCHEDULED',
        })

    output = {
        'lastUpdated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'matches': matches,
    }

    out_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'matches.json')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f'Wrote {len(matches)} matches to {out_path}')

if __name__ == '__main__':
    main()
