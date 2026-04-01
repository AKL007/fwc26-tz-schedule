// Shared utilities for WC 2026 schedule app
window.WC = (function () {
  'use strict';

  const STAGE_LABELS = {
    GROUP_STAGE: 'Group',
    ROUND_OF_32: 'R32',
    ROUND_OF_16: 'R16',
    QUARTER_FINAL: 'QF',
    SEMI_FINAL: 'SF',
    THIRD_PLACE: '3rd Place',
    MATCH_FOR_THIRD_PLACE: '3rd Place',
    FINAL: 'Final',
  };

  const COMMON_TIMEZONES = [
    'Pacific/Auckland', 'Australia/Sydney', 'Australia/Perth',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
    'Africa/Nairobi', 'Europe/Moscow', 'Europe/Istanbul',
    'Europe/Athens', 'Europe/Berlin', 'Europe/Paris', 'Europe/London',
    'Atlantic/Azores', 'America/Sao_Paulo', 'America/Buenos_Aires',
    'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  ];

  const GROUP_COLORS = {
    'Group A': '#1a5276', 'Group B': '#1e8449', 'Group C': '#2e86c1',
    'Group D': '#d35400', 'Group E': '#6c3483', 'Group F': '#cb4335',
    'Group G': '#7d3c98', 'Group H': '#c0392b', 'Group I': '#d4ac0d',
    'Group J': '#117a65', 'Group K': '#884ea0', 'Group L': '#2c3e50',
  };

  const STAGE_COLORS = {
    ROUND_OF_32: '#5d6d7e', ROUND_OF_16: '#2e4053',
    QUARTER_FINAL: '#7d5a00', SEMI_FINAL: '#6a1b9a',
    THIRD_PLACE: '#6a1b9a', MATCH_FOR_THIRD_PLACE: '#6a1b9a',
    FINAL: '#b71c1c',
  };

  let currentTz = '';
  let allMatches = [];

  function detectTimezone() {
    const params = new URLSearchParams(location.search);
    return params.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function formatTime(utcDate, tz) {
    return new Date(utcDate).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
      timeZone: tz || currentTz, hour12: false,
    });
  }

  function formatDate(utcDate, tz) {
    return new Date(utcDate).toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: tz || currentTz,
    });
  }

  function formatDateShort(utcDate, tz) {
    return new Date(utcDate).toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: tz || currentTz,
    });
  }

  function getLocalDateKey(utcDate, tz) {
    return new Date(utcDate).toLocaleDateString('en-CA', { timeZone: tz || currentTz });
  }

  function getLocalHour(utcDate, tz) {
    const d = new Date(utcDate);
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: 'numeric',
      timeZone: tz || currentTz, hour12: false,
    }).formatToParts(d);
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return h + m / 60;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function getMatchColor(match) {
    if (match.group && GROUP_COLORS[match.group]) return GROUP_COLORS[match.group];
    if (STAGE_COLORS[match.stage]) return STAGE_COLORS[match.stage];
    return '#5d6d7e';
  }

  function initTimezoneUI(onChangeCallback) {
    const label = document.getElementById('tz-label');
    const btn = document.getElementById('tz-change');
    const sel = document.getElementById('tz-select');

    label.textContent = currentTz.replace(/_/g, ' ');

    const tzSet = new Set(COMMON_TIMEZONES);
    tzSet.add(currentTz);
    const sorted = [...tzSet].sort();
    sel.innerHTML = sorted.map(tz =>
      `<option value="${tz}" ${tz === currentTz ? 'selected' : ''}>${tz.replace(/_/g, ' ')}</option>`
    ).join('');

    btn.addEventListener('click', () => {
      btn.classList.add('hidden');
      sel.classList.remove('hidden');
      sel.focus();
    });

    sel.addEventListener('change', () => {
      currentTz = sel.value;
      const params = new URLSearchParams(location.search);
      params.set('tz', currentTz);
      history.replaceState(null, '', '?' + params.toString());
      label.textContent = currentTz.replace(/_/g, ' ');
      sel.classList.add('hidden');
      btn.classList.remove('hidden');
      if (onChangeCallback) onChangeCallback();
    });

    sel.addEventListener('blur', () => {
      sel.classList.add('hidden');
      btn.classList.remove('hidden');
    });
  }

  async function loadMatches() {
    const res = await fetch('data/matches.json');
    const data = await res.json();
    allMatches = data.matches;
    return data;
  }

  function teamHtml(name, escaped) {
    if (isRealTeam(name)) return escaped || esc(name);
    return `<span class="tbd-chip">${escaped || esc(name)}</span>`;
  }

  function isRealTeam(name) {
    if (!name || name === 'TBD') return false;
    if (/^\d/.test(name)) return false;              // "1st Group A", "2nd Group B", "3A/B/C/D/F"
    if (/^(Winner|Loser) Match/.test(name)) return false;
    if (/Path \w+ winner/i.test(name)) return false; // "UEFA Path A winner", "IC Path 1 winner"
    return true;
  }

  function setTz(tz) { currentTz = tz; }
  function getTz() { return currentTz; }
  function getMatches() { return allMatches; }

  return {
    STAGE_LABELS, COMMON_TIMEZONES, GROUP_COLORS, STAGE_COLORS,
    detectTimezone, formatTime, formatDate, formatDateShort,
    getLocalDateKey, getLocalHour, esc, getMatchColor,
    isRealTeam, teamHtml, initTimezoneUI, loadMatches,
    setTz, getTz, getMatches,
  };
})();
