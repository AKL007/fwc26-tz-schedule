// Shared utilities for WC 2026 schedule app
window.WC = (function () {
  'use strict';

  const TEAM_DISPLAY_NAMES = {
    'Turkey': 'Türkiye',
    'South Korea': 'Korea Republic',
    'Ivory Coast': "Côte d'Ivoire",
    'Czech Republic': 'Czechia',
    'DR Congo': 'DR Congo',
    'Bosnia & Herzegovina': 'Bosnia & Herzegovina',
    'Cape Verde': 'Cabo Verde',
  };

  function displayTeamName(name) {
    return TEAM_DISPLAY_NAMES[name] || name;
  }

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

  const _GROUP_MAP = {
    A: '#1a5276', B: '#1e8449', C: '#2e86c1', D: '#d35400',
    E: '#6c3483', F: '#cb4335', G: '#7d3c98', H: '#c0392b',
    I: '#d4ac0d', J: '#117a65', K: '#884ea0', L: '#2c3e50',
  };
  // Support both "Group A" and "GROUP_A" formats
  const GROUP_COLORS = {};
  for (const [letter, color] of Object.entries(_GROUP_MAP)) {
    GROUP_COLORS['Group ' + letter] = color;
    GROUP_COLORS['GROUP_' + letter] = color;
  }

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

  function teamHtml(name) {
    const display = displayTeamName(name);
    if (isRealTeam(name)) return esc(display);
    return `<span class="tbd-chip">${esc(display)}</span>`;
  }

  function isRealTeam(name) {
    if (!name || name === 'TBD') return false;
    if (/^\d/.test(name)) return false;              // "1st Group A", "2nd Group B", "3A/B/C/D/F"
    if (/^(Winner|Loser) Match/.test(name)) return false;
    if (/Path \w+ winner/i.test(name)) return false; // "UEFA Path A winner", "IC Path 1 winner"
    return true;
  }

  function formatLastUpdated(isoDate) {
    const d = new Date(isoDate);
    const day = d.getDate();
    const suffix = [, 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10) * (day % 10)] || 'th';
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Last updated: ${day}${suffix} ${month}, ${year} ${time}`;
  }

  function initShareButton() {
    const btn = document.getElementById('share-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const url = window.location.href;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && navigator.share) {
        try {
          await navigator.share({ title: 'FIFA World Cup 2026 Schedule', url });
        } catch (e) { /* user cancelled */ }
      } else {
        await navigator.clipboard.writeText(url);
        btn.classList.add('shared');
        btn.title = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('shared');
          btn.title = 'Share';
        }, 2000);
      }
    });
  }

  function setTz(tz) { currentTz = tz; }
  function getTz() { return currentTz; }
  function getMatches() { return allMatches; }

  return {
    STAGE_LABELS, COMMON_TIMEZONES, GROUP_COLORS, STAGE_COLORS,
    detectTimezone, formatTime, formatDate, formatDateShort,
    getLocalDateKey, getLocalHour, esc, getMatchColor,
    isRealTeam, teamHtml, displayTeamName, formatLastUpdated, initTimezoneUI, initShareButton, loadMatches,
    setTz, getTz, getMatches,
  };
})();
