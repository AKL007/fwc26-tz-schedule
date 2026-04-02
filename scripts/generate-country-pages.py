#!/usr/bin/env python3
"""Generate country-specific landing pages for SEO.

Each page has country-specific title, meta tags, and default timezone,
but loads the same shared JS/CSS from the root.
"""

import os

COUNTRIES = [
    {'slug': 'uk', 'name': 'UK', 'long': 'United Kingdom', 'tz': 'Europe/London', 'demonym': 'UK'},
    {'slug': 'india', 'name': 'India', 'long': 'India', 'tz': 'Asia/Kolkata', 'demonym': 'Indian'},
    {'slug': 'usa', 'name': 'USA', 'long': 'United States', 'tz': 'America/New_York', 'demonym': 'US'},
    {'slug': 'brazil', 'name': 'Brazil', 'long': 'Brazil', 'tz': 'America/Sao_Paulo', 'demonym': 'Brazilian'},
    {'slug': 'germany', 'name': 'Germany', 'long': 'Germany', 'tz': 'Europe/Berlin', 'demonym': 'German'},
    {'slug': 'france', 'name': 'France', 'long': 'France', 'tz': 'Europe/Paris', 'demonym': 'French'},
    {'slug': 'japan', 'name': 'Japan', 'long': 'Japan', 'tz': 'Asia/Tokyo', 'demonym': 'Japanese'},
    {'slug': 'mexico', 'name': 'Mexico', 'long': 'Mexico', 'tz': 'America/Mexico_City', 'demonym': 'Mexican'},
    {'slug': 'canada', 'name': 'Canada', 'long': 'Canada', 'tz': 'America/Toronto', 'demonym': 'Canadian'},
    {'slug': 'south-korea', 'name': 'South Korea', 'long': 'South Korea', 'tz': 'Asia/Seoul', 'demonym': 'Korean'},
    {'slug': 'indonesia', 'name': 'Indonesia', 'long': 'Indonesia', 'tz': 'Asia/Jakarta', 'demonym': 'Indonesian'},
    {'slug': 'turkey', 'name': 'Türkiye', 'long': 'Türkiye', 'tz': 'Europe/Istanbul', 'demonym': 'Turkish'},
    {'slug': 'spain', 'name': 'Spain', 'long': 'Spain', 'tz': 'Europe/Madrid', 'demonym': 'Spanish'},
    {'slug': 'argentina', 'name': 'Argentina', 'long': 'Argentina', 'tz': 'America/Buenos_Aires', 'demonym': 'Argentine'},
    {'slug': 'australia', 'name': 'Australia', 'long': 'Australia', 'tz': 'Australia/Sydney', 'demonym': 'Australian'},
    {'slug': 'italy', 'name': 'Italy', 'long': 'Italy', 'tz': 'Europe/Rome', 'demonym': 'Italian'},
    {'slug': 'netherlands', 'name': 'Netherlands', 'long': 'Netherlands', 'tz': 'Europe/Amsterdam', 'demonym': 'Dutch'},
    {'slug': 'saudi-arabia', 'name': 'Saudi Arabia', 'long': 'Saudi Arabia', 'tz': 'Asia/Riyadh', 'demonym': 'Saudi'},
    {'slug': 'egypt', 'name': 'Egypt', 'long': 'Egypt', 'tz': 'Africa/Cairo', 'demonym': 'Egyptian'},
    {'slug': 'nigeria', 'name': 'Nigeria', 'long': 'Nigeria', 'tz': 'Africa/Lagos', 'demonym': 'Nigerian'},
]

TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <title>FIFA World Cup 2026 Schedule — {name} Kick-off Times ({tz_label})</title>
  <meta name="description" content="FIFA World Cup 2026 match schedule with kick-off times in {long} time ({tz_label}). All 104 matches, filter by team, venue, or group.">
  <meta name="keywords" content="FIFA World Cup 2026, {long}, schedule, kick-off times, {tz_label}, {demonym} time, fixtures">
  <link rel="canonical" href="https://wc-26-schedule.com/{slug}/">

  <meta property="og:title" content="World Cup 2026 Schedule — {name} Times">
  <meta property="og:description" content="All 104 World Cup 2026 matches with kick-off times in {long} time ({tz_label}).">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://wc-26-schedule.com/{slug}/">
  <meta property="og:image" content="https://wc-26-schedule.com/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://wc-26-schedule.com/og-image.jpg">
  <meta name="twitter:title" content="World Cup 2026 Schedule — {name} Times">
  <meta name="twitter:description" content="All World Cup 2026 kick-off times in {tz_label}.">

  <link rel="preload" href="/data/matches.json" as="fetch" crossorigin>
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="../timeline.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "FIFA World Cup 2026 Schedule — {name}",
    "description": "World Cup 2026 match times in {long} timezone ({tz_label})",
    "url": "https://wc-26-schedule.com/{slug}/",
    "about": {{
      "@type": "SportsEvent",
      "name": "FIFA World Cup 2026",
      "startDate": "2026-06-11",
      "endDate": "2026-07-19",
      "location": {{
        "@type": "Place",
        "name": "USA, Canada & Mexico"
      }}
    }}
  }}
  </script>

  <script>
    // Set default timezone for this country page
    if (!new URLSearchParams(location.search).has('tz')) {{
      const url = new URL(location.href);
      url.searchParams.set('tz', '{tz}');
      history.replaceState(null, '', url.toString());
    }}
  </script>
</head>
<body>
  <header>
    <h1>World Cup 2026 Schedule — {name} Times</h1>
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
          <a href="index.html" class="active">Timeline</a>
          <a href="../list.html?tz={tz}">List</a>
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

  <p class="intro">Complete FIFA World Cup 2026 schedule with all 104 match kick-off times shown in {long} time ({tz_label}). The tournament runs from June 11 to July 19, 2026 across 16 venues in the USA, Canada, and Mexico.</p>

  <nav class="filters">
    <select id="filter-team" aria-label="Filter by team">
      <option value="">All Teams</option>
    </select>
    <select id="filter-venue" aria-label="Filter by venue">
      <option value="">All Venues</option>
    </select>
    <select id="filter-group" aria-label="Filter by group">
      <option value="">All Groups</option>
    </select>
    <select id="filter-stage" aria-label="Filter by stage">
      <option value="">All Stages</option>
    </select>
    <button id="filter-clear" type="button" class="hidden">Clear filters</button>
  </nav>

  <div id="timeline-header" class="timeline-header-sticky"></div>
  <div class="timeline-wrapper" id="timeline-wrapper">
    <div id="timeline-grid" class="timeline-grid"></div>
  </div>

  <div class="timeline-legend" id="timeline-legend"></div>

  <footer>
    <p>Times shown in {tz_label}. <span id="last-updated"></span></p>
    <p>Data thanks to <a href="https://www.football-data.org" target="_blank" rel="noopener">football-data.org</a> &amp; <a href="https://github.com/openfootball" target="_blank" rel="noopener">OpenFootball</a></p>
    <p>Made with &#10084;&#65039; by <a href="https://akshaylal.com" target="_blank" rel="noopener">akshaylal.com</a></p>
    <p class="country-links">Also available for: {other_countries}</p>
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

  <script src="../shared.js" defer></script>
  <script src="../timeline.js" defer></script>
</body>
</html>
'''

def get_tz_label(tz):
    """Human-friendly timezone label."""
    labels = {
        'Europe/London': 'GMT/BST',
        'Asia/Kolkata': 'IST',
        'America/New_York': 'ET',
        'America/Sao_Paulo': 'BRT',
        'Europe/Berlin': 'CET',
        'Europe/Paris': 'CET',
        'Asia/Tokyo': 'JST',
        'America/Mexico_City': 'CST',
        'America/Toronto': 'ET',
        'Asia/Seoul': 'KST',
        'Asia/Jakarta': 'WIB',
        'Europe/Istanbul': 'TRT',
        'Europe/Madrid': 'CET',
        'America/Buenos_Aires': 'ART',
        'Australia/Sydney': 'AEST',
        'Europe/Rome': 'CET',
        'Europe/Amsterdam': 'CET',
        'Asia/Riyadh': 'AST',
        'Africa/Cairo': 'EET',
        'Africa/Lagos': 'WAT',
    }
    return labels.get(tz, tz)

def main():
    root = os.path.join(os.path.dirname(__file__), '..')

    for country in COUNTRIES:
        slug = country['slug']
        tz_label = get_tz_label(country['tz'])

        # Build other countries links
        others = [c for c in COUNTRIES if c['slug'] != slug]
        other_links = ', '.join(
            f'<a href="/{c["slug"]}/">{c["name"]}</a>' for c in others
        )

        page = TEMPLATE.format(
            slug=slug,
            name=country['name'],
            long=country['long'],
            tz=country['tz'],
            tz_label=tz_label,
            demonym=country['demonym'],
            other_countries=other_links,
        )

        out_dir = os.path.join(root, slug)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, 'index.html')
        with open(out_path, 'w') as f:
            f.write(page)
        print(f'  /{slug}/index.html')

    # Generate sitemap
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += '  <url><loc>https://wc-26-schedule.com/</loc><priority>1.0</priority></url>\n'
    sitemap += '  <url><loc>https://wc-26-schedule.com/list.html</loc><priority>0.8</priority></url>\n'
    for c in COUNTRIES:
        sitemap += f'  <url><loc>https://wc-26-schedule.com/{c["slug"]}/</loc><priority>0.9</priority></url>\n'
    sitemap += '</urlset>\n'

    with open(os.path.join(root, 'sitemap.xml'), 'w') as f:
        f.write(sitemap)
    print('  /sitemap.xml')

    # Generate robots.txt
    robots = 'User-agent: *\nAllow: /\nSitemap: https://wc-26-schedule.com/sitemap.xml\n'
    with open(os.path.join(root, 'robots.txt'), 'w') as f:
        f.write(robots)
    print('  /robots.txt')

    print(f'\nGenerated {len(COUNTRIES)} country pages + sitemap + robots.txt')

if __name__ == '__main__':
    main()
