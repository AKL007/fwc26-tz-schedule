(function () {
  'use strict';

  const { STAGE_LABELS, formatTime, formatDate, getLocalDateKey,
    esc, isRealTeam, teamHtml, displayTeamName, formatLastUpdated,
    detectTimezone, initTimezoneUI, initShareSheet, initMultiFilters, loadMatches,
    getFilteredMatches,
    setTz, getTz, getMatches } = window.WC;

  // --- Filters ---

  function populateFilterOptions(matches) {
    const teams = new Set();
    const venues = new Set();
    const groups = new Set();
    const stages = new Set();

    matches.forEach(m => {
      if (isRealTeam(m.homeTeam)) teams.add(m.homeTeam);
      if (isRealTeam(m.awayTeam)) teams.add(m.awayTeam);
      venues.add(m.venue);
      if (m.group) groups.add(m.group);
      stages.add(m.stage);
    });

    fillMenu('team', [...teams].sort(), displayTeamName);
    fillMenu('venue', [...venues].sort());
    fillMenu('group', [...groups].sort((a, b) => a.localeCompare(b)), v => 'Group ' + v.replace('Group ', '').replace('GROUP_', ''));
    fillMenu('stage', [...stages].sort((a, b) => {
      const order = Object.keys(STAGE_LABELS);
      return order.indexOf(a) - order.indexOf(b);
    }), v => STAGE_LABELS[v] || v);
  }

  function fillMenu(type, values, labelFn) {
    const dropdown = document.querySelector(`.filter-dropdown[data-type="${type}"]`);
    if (!dropdown) return;
    const menu = dropdown.querySelector('.filter-menu');
    const active = window.WC.getActiveFilters()[type] || [];
    menu.innerHTML = values.filter(v => v).map(v =>
      `<label><input type="checkbox" value="${esc(v)}" ${active.includes(v) ? 'checked' : ''}> ${esc(labelFn ? labelFn(v) : v)}</label>`
    ).join('');
  }

  // --- Rendering ---

  function render() {
    const filtered = getFilteredMatches();
    const container = document.getElementById('match-list');
    const tz = getTz();

    if (filtered.length === 0) {
      container.innerHTML = '<div class="no-matches">No matches found</div>';
      return;
    }

    const grouped = new Map();
    filtered.forEach(m => {
      const key = getLocalDateKey(m.utcDate, tz);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(m);
    });

    let html = '';
    for (const [, matches] of grouped) {
      const dateLabel = formatDate(matches[0].utcDate, tz);
      html += `<section class="date-group">
        <h2 class="date-heading">${dateLabel}</h2>`;

      matches.forEach(m => {
        const time = formatTime(m.utcDate, tz);
        const stageLabel = STAGE_LABELS[m.stage] || m.stage;
        const badgeText = m.group ? 'Grp ' + m.group.replace('Group ', '').replace('GROUP_', '') : stageLabel;
        const scoreText = m.score.home !== null
          ? `<span class="score">${m.score.home} - ${m.score.away}</span>`
          : '<span class="vs">vs</span>';
        const statusHtml = m.status === 'LIVE'
          ? '<div class="match-status-live">LIVE</div>'
          : '';

        html += `<div class="match-card">
          <div class="match-time">${time}${statusHtml}</div>
          <div class="match-teams">
            <div class="team">${teamHtml(m.homeTeam)}</div>
            ${scoreText}
            <div class="team">${teamHtml(m.awayTeam)}</div>
          </div>
          <div class="match-meta">
            <div class="match-venue" title="${esc(m.venue)}">${esc(m.venue)}</div>
            <span class="stage-badge" data-stage="${m.stage}">${badgeText}</span>
          </div>
        </div>`;
      });

      html += '</section>';
    }

    container.innerHTML = html;
  }

  // --- Init ---

  async function init() {
    setTz(detectTimezone());

    const data = await loadMatches();

    const updated = document.getElementById('last-updated');
    if (data.lastUpdated) {
      updated.textContent = formatLastUpdated(data.lastUpdated);
    }

    populateFilterOptions(getMatches());
    initTimezoneUI(render);
    initShareSheet();
    initMultiFilters(render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
