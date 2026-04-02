#!/usr/bin/env python3
"""Generate team-specific landing pages with per-match JSON-LD schema."""

import json
import os
import re

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'matches.json')

DISPLAY_NAMES = {
    'Turkey': 'Türkiye', 'South Korea': 'Korea Republic',
    'Ivory Coast': "Côte d'Ivoire", 'Czech Republic': 'Czechia',
    'DR Congo': 'DR Congo', 'Cape Verde': 'Cabo Verde',
    'Bosnia & Herzegovina': 'Bosnia & Herzegovina',
}

STAGE_LABELS = {
    'GROUP_STAGE': 'Group Stage', 'ROUND_OF_32': 'Round of 32',
    'ROUND_OF_16': 'Round of 16', 'QUARTER_FINAL': 'Quarter-final',
    'SEMI_FINAL': 'Semi-final', 'THIRD_PLACE': 'Third Place',
    'MATCH_FOR_THIRD_PLACE': 'Third Place', 'FINAL': 'Final',
}

def slugify(name):
    s = name.lower()
    s = s.replace("'", '').replace('&', 'and')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s

def display_name(name):
    return DISPLAY_NAMES.get(name, name)

def get_teams(data):
    teams = set()
    for m in data['matches']:
        for t in (m['homeTeam'], m['awayTeam']):
            if t and t != 'TBD' and not re.match(r'^\d', t):
                if 'Winner' not in t and 'Loser' not in t and 'Path' not in t:
                    teams.add(t)
    return sorted(teams)

def get_team_matches(data, team):
    return [m for m in data['matches'] if m['homeTeam'] == team or m['awayTeam'] == team]

def match_schema(m):
    """Generate JSON-LD SportsEvent for a single match."""
    return {
        '@type': 'SportsEvent',
        'name': f'{display_name(m["homeTeam"])} vs {display_name(m["awayTeam"])}',
        'startDate': m['utcDate'],
        'location': {
            '@type': 'Place',
            'name': m.get('venue') or 'TBD',
        },
        'homeTeam': {'@type': 'SportsTeam', 'name': display_name(m['homeTeam'])},
        'awayTeam': {'@type': 'SportsTeam', 'name': display_name(m['awayTeam'])},
        'eventStatus': 'https://schema.org/EventScheduled',
        'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
        'description': f'FIFA World Cup 2026 - {STAGE_LABELS.get(m.get("stage", ""), m.get("stage", ""))}',
    }

TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="../../favicon.svg" type="image/svg+xml">
  <title>{display} — FIFA World Cup 2026 Schedule & Fixtures</title>
  <meta name="description" content="{display} World Cup 2026 fixtures. All {match_count} matches with kick-off times in your timezone. Group stage, knockout rounds, venues.">
  <meta name="keywords" content="{display}, World Cup 2026, fixtures, schedule, kick-off times, {raw_name}">
  <link rel="canonical" href="https://wc-26-schedule.com/team/{slug}/">

  <meta property="og:title" content="{display} — World Cup 2026 Fixtures">
  <meta property="og:description" content="All {display} matches at the 2026 World Cup with local kick-off times.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://wc-26-schedule.com/team/{slug}/">
  <meta property="og:image" content="https://wc-26-schedule.com/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://wc-26-schedule.com/og-image.jpg">
  <meta name="twitter:title" content="{display} — World Cup 2026 Fixtures">
  <meta name="twitter:description" content="All {display} matches at the 2026 World Cup.">

  <link rel="preload" href="/data/matches.json" as="fetch" crossorigin>
  <link rel="stylesheet" href="../../style.css">
  <link rel="stylesheet" href="../../timeline.css">

  <script type="application/ld+json">
{schema_json}
  </script>

  <script>
    // Pre-set team filter
    if (!new URLSearchParams(location.search).has('team')) {{
      const url = new URL(location.href);
      url.searchParams.set('team', '{raw_name}');
      history.replaceState(null, '', url.toString());
    }}
  </script>
</head>
<body>
  <header>
    <h1>{display} — World Cup 2026</h1>
    <div class="subtitle-row">
      <p class="subtitle">Match Schedule</p>
      <span class="divider">|</span>
      <div class="tz-display">
        <span id="tz-label"></span>
        <button id="tz-change" type="button" title="Change timezone">Change</button>
        <select id="tz-select" class="hidden"></select>
      </div>
    </div>
    <div class="header-actions">
      <div class="header-actions-side header-actions-right">
        <nav class="view-nav">
          <a href="../../index.html" class="active">Timeline</a>
          <a href="../../list.html">List</a>
        </nav>
      </div>
      <span class="divider">|</span>
      <div class="header-actions-side header-actions-left">
        <div class="share-group">
          <button id="share-trigger" type="button" title="Share">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <p class="intro">{display} at the FIFA World Cup 2026. {match_count} matches with kick-off times in your local timezone. {group_info}</p>

  <div class="filters-wrap">
    <nav class="filters">
      <div class="filter-dropdown" data-type="team">
        <button class="filter-trigger" type="button">All Teams</button>
        <div class="filter-menu hidden"></div>
      </div>
      <div class="filter-dropdown" data-type="venue">
        <button class="filter-trigger" type="button">All Venues</button>
        <div class="filter-menu hidden"></div>
      </div>
      <div class="filter-dropdown" data-type="group">
        <button class="filter-trigger" type="button">All Groups</button>
        <div class="filter-menu hidden"></div>
      </div>
      <div class="filter-dropdown" data-type="stage">
        <button class="filter-trigger" type="button">All Stages</button>
        <div class="filter-menu hidden"></div>
      </div>
    </nav>
  </div>
  <div id="filter-chips" class="filter-chips"></div>

  <div id="timeline-header" class="timeline-header-sticky"></div>
  <div class="timeline-wrapper" id="timeline-wrapper">
    <div id="timeline-grid" class="timeline-grid"></div>
  </div>

  <div class="timeline-legend" id="timeline-legend"></div>

  <footer>
    <p>Times shown in your local timezone. <span id="last-updated"></span></p>
    <p>Data thanks to <a href="https://www.football-data.org" target="_blank" rel="noopener">football-data.org</a> &amp; <a href="https://github.com/openfootball" target="_blank" rel="noopener">OpenFootball</a></p>
    <p>Made with &#10084;&#65039; by <a href="https://akshaylal.com" target="_blank" rel="noopener">akshaylal.com</a></p>
    <p class="country-links">Other teams: {other_teams}</p>
  </footer>

  <div id="share-sheet" class="share-sheet hidden">
    <div class="share-sheet-backdrop"></div>
    <div class="share-sheet-panel">
      <div class="share-sheet-header">
        <span>Share</span>
        <button id="share-sheet-close" type="button">&times;</button>
      </div>
      <button id="share-copy-link" class="share-sheet-action">
        <span class="share-sheet-icon">&#128279;</span>
        <span class="share-sheet-label">Copy link</span>
        <span class="share-sheet-status"></span>
      </button>
      <button id="share-copy-image" class="share-sheet-action">
        <span class="share-sheet-icon">&#128444;&#65039;</span>
        <span class="share-sheet-label">Copy schedule</span>
        <span class="share-sheet-status"></span>
      </button>
      <button id="share-download-image" class="share-sheet-action">
        <span class="share-sheet-icon">&#11015;&#65039;</span>
        <span class="share-sheet-label">Download schedule</span>
        <span class="share-sheet-status"></span>
      </button>
      <button id="share-add-calendar" class="share-sheet-action">
        <span class="share-sheet-icon">&#128197;</span>
        <span class="share-sheet-label">Add to calendar</span>
        <span class="share-sheet-status"></span>
      </button>
    </div>
  </div>

  <script src="../../shared.js" defer></script>
  <script src="../../timeline.js" defer></script>
</body>
</html>
'''

def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    teams = get_teams(data)
    root = os.path.join(os.path.dirname(__file__), '..')

    for team in teams:
        slug = slugify(team)
        dn = display_name(team)
        matches = get_team_matches(data, team)

        # Group info
        groups = set(m.get('group', '') for m in matches if m.get('group'))
        group_str = ''
        if groups:
            glabels = ', '.join('Group ' + g.replace('GROUP_', '').replace('Group ', '') for g in sorted(groups))
            group_str = f'Playing in {glabels}.'

        # Schema
        schema = {
            '@context': 'https://schema.org',
            '@graph': [match_schema(m) for m in matches],
        }
        schema_json = json.dumps(schema, indent=2, ensure_ascii=False)

        # Other teams links
        others = [t for t in teams if t != team]
        other_links = ', '.join(
            f'<a href="/team/{slugify(t)}/">{display_name(t)}</a>' for t in others
        )

        page = TEMPLATE.format(
            slug=slug,
            display=dn,
            raw_name=team.replace("'", "\\'"),
            match_count=len(matches),
            group_info=group_str,
            schema_json=schema_json,
            other_teams=other_links,
        )

        out_dir = os.path.join(root, 'team', slug)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w') as f:
            f.write(page)
        print(f'  /team/{slug}/')

    # Update sitemap
    sitemap_path = os.path.join(root, 'sitemap.xml')
    with open(sitemap_path) as f:
        sitemap = f.read()

    # Add team URLs before closing tag
    team_entries = ''
    for team in teams:
        slug = slugify(team)
        team_entries += f'  <url><loc>https://wc-26-schedule.com/team/{slug}/</loc><priority>0.8</priority></url>\n'

    if '/team/' not in sitemap:
        sitemap = sitemap.replace('</urlset>', team_entries + '</urlset>')
        with open(sitemap_path, 'w') as f:
            f.write(sitemap)
        print('  Updated sitemap.xml')

    print(f'\nGenerated {len(teams)} team pages')

if __name__ == '__main__':
    main()
