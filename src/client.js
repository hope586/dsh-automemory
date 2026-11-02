import { zh, en, errorText } from './i18n.js';

const { createElement: h, useState, useEffect, useRef, useCallback } = React;
const NS = 'autoMemory';
const inject = ['slots', 'locale', 'layout', 'uiWorkspace', 'sessions', 'workspaces'];
const endpoint = '/api/dsh-automemory';
const failure = (code, message, params) => Object.assign(new Error(message || code), { code, params });
let serviceAvailable = true;
const availabilityListeners = new Set();
const subscribeAvailability = listener => { availabilityListeners.add(listener); return () => availabilityListeners.delete(listener); };
const availabilitySnapshot = () => serviceAvailable;
function setAvailability(available) {
  if (serviceAvailable === available) return;
  serviceAvailable = available;
  for (const listener of availabilityListeners) listener();
}

/** Lightweight route liveness, independent of project/catalog enumeration. */
export function createAvailabilityMonitor({ request = fetch, onChange = setAvailability, intervalMs = 2000, timers = globalThis, documentTarget = typeof document === 'undefined' ? null : document, windowTarget = typeof window === 'undefined' ? null : window } = {}) {
  let stopped = false, active = null;
  const check = async () => {
    if (stopped || active || documentTarget?.hidden) return;
    const controller = new AbortController(); active = controller;
    const timeout = timers.setTimeout?.(() => { controller.abort(); if (!stopped) onChange(false); }, 1500);
    try {
      const response = await request(`${endpoint}/status`, { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      let available = false;
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const body = await response.json(); available = body?.ok === true && (body.data ?? body.value)?.enabled === true;
      }
      if (!stopped && !controller.signal.aborted) onChange(available);
    } catch { if (!stopped && !controller.signal.aborted) onChange(false); }
    finally { if (timeout !== undefined) timers.clearTimeout?.(timeout); if (active === controller) active = null; }
  };
  const wake = () => { void check(); };
  const timer = timers.setInterval?.(wake, intervalMs);
  windowTarget?.addEventListener('focus', wake); documentTarget?.addEventListener('visibilitychange', wake);
  void check();
  return { check, dispose() { stopped = true; active?.abort(); if (timer !== undefined) timers.clearInterval?.(timer); windowTarget?.removeEventListener('focus', wake); documentTarget?.removeEventListener('visibilitychange', wake); } };
}

async function decode(response) {
  if (response.status === 404) setAvailability(false);
  if (response.status === 401 || response.status === 403) throw failure('accessDenied');
  if (!response.headers.get('content-type')?.includes('application/json')) throw failure(response.status === 404 ? 'unavailable' : 'responseInvalid');
  let body;
  try { body = await response.json(); } catch { throw failure('responseInvalid'); }
  if (!response.ok || body?.ok !== true) {
    const error = body?.error;
    throw failure(error?.code || body?.errorKey || 'requestFailed', typeof error === 'string' ? error : error?.message);
  }
  const data = body.data ?? body.value;
  if (!data || typeof data !== 'object') throw failure('responseInvalid');
  setAvailability(true); return data;
}
export async function catalogRequest(signal) {
  return decode(await fetch(endpoint + '/catalog', { credentials: 'same-origin', cache: 'no-store', signal }));
}
export async function apiRequest(scope, action, params = {}, signal) {
  const target = typeof scope === 'string' ? { sessionId: scope } : scope || {};
  const identity = {};
  if (target.workspaceId) identity.workspaceId = target.workspaceId;
  if (target.sessionId) identity.sessionId = target.sessionId;
  if (action && !Object.keys(identity).length && !['settings-save', 'user-profile-toggle', 'manager-open', 'manager-state', 'manager-send', 'manager-close', 'manager-confirm'].includes(action)) throw failure('noSession');
  const url = action ? endpoint + '/action' : Object.keys(identity).length ? endpoint + '/state?' + new URLSearchParams(identity) : endpoint + '/global';
  const clean = { ...params }; delete clean.sessionId; delete clean.workspaceId; delete clean.action;
  const response = await fetch(url, {
    method: action ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    ...(action ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...clean, ...identity, action }) } : {}),
  });
  const data = await decode(response);
  if (data.sessionId && identity.sessionId && data.sessionId !== identity.sessionId) throw failure('sessionMismatch');
  if (identity.workspaceId && (data.workspace?.id || data.workspaceId) && (data.workspace?.id || data.workspaceId) !== identity.workspaceId) throw failure('sessionMismatch');
  return data;
}

export function receiptPresentation(value) {
  const receipt = value?.receipt || value || {};
  const status = receipt.status || 'unknown';
  const cleanup = receipt.cleanup_status ?? receipt.cleanupStatus;
  const tone = ['failed', 'rejected', 'cancelled'].includes(status) ? 'error' : ['accepted', 'queued', 'running'].includes(status) || ['pending', 'incomplete'].includes(cleanup) ? 'warning' : status === 'committed' ? 'success' : 'neutral';
  return { status, tone, cleanup, message: receipt.message, requestId: receipt.request_id ?? receipt.requestId, jobId: receipt.job_id ?? receipt.jobId, scope: receipt.scope_statement ?? receipt.scopeStatement, errors: receipt.errors || [], results: receipt.results || [] };
}

export function visibleDreamActivity(items = []) {
  return items.filter(item => String(item.channel || '').toUpperCase() === 'DREAMING' && item.status === 'committed' && item.changed === true);
}

export function jobPresentation(job, t) {
  const waiting = ['queued', 'paused'].includes(job.status) && !!job.deferral;
  return { waiting, label: waiting ? t('waitingModel') : statusLabel(job.status, t),
    message: waiting ? t('modelWaitHint') : job.error ? job.userMessage || t('consolidationFailed') : null };
}
export function usagePresentation(usage, t) {
  const format = new Intl.NumberFormat(t('formatLocale'), { maximumFractionDigits: 8 });
  return [['calls', 'usageCalls'], ['totalTokens', 'usageTotal'], ['cacheReadTokens', 'usageCacheRead'], ['cost', 'usageCost']].map(([key, label]) => {
    const value = usage?.[key];
    return { key, label: t(label), value: typeof value === 'number' && Number.isFinite(value) && value >= 0 ? format.format(value) : t('unknown') };
  });
}

export function normaliseSettings(input) {
  const number = (value, field, min, max) => {
    const n = typeof value === 'number' ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
    if (!Number.isSafeInteger(n) || n < min || n > max) throw failure('invalidNumber', null, { field });
    return n;
  };
  const models = {};
  for (const role of ['g2', 'dreamer', 'reviewer', ...(input.models?.manager ? ['manager'] : [])]) {
    const provider = String(input.models?.[role]?.provider || '').trim();
    const model = String(input.models?.[role]?.model || '').trim();
    if (Boolean(provider) !== Boolean(model) || (role !== 'g2' && !provider)) throw failure('invalidModel');
    models[role] = provider ? { provider, model, ...(input.models?.[role]?.reasoningEffort ? { reasoningEffort: input.models[role].reasoningEffort } : {}) } : null;
  }
  return {
    ...(input.revision !== undefined ? { revision: input.revision } : {}),
    models,
    dreamIntervalHours: number(input.dreamIntervalHours, 'interval', 24, 8760),
    auditRetentionDays: number(input.auditRetentionDays, 'retention', 1, 3650),
    budget: {
      maxInputTokens: number(input.budget?.maxInputTokens, 'maxInputTokens', 1024, 2000000),
      maxOutputTokens: number(input.budget?.maxOutputTokens, 'maxOutputTokens', 128, 32768),
      maxSteps: number(input.budget?.maxSteps, 'maxSteps', 1, 32),
      maxDailyTokens: number(input.budget?.maxDailyTokens, 'maxDailyTokens', 1024, 100000000),
    },
  };
}

function Icon({ name = 'memory', size = 18 } = {}) {
  const paths = {
    memory: 'M7 3.5h10a2 2 0 0 1 2 2v15l-7-3-7 3v-15a2 2 0 0 1 2-2Z M9 8h6 M9 11.5h4',
    search: 'M10.5 3.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4.5 4.5',
    close: 'm6 6 12 12M6 18 18 6', refresh: 'M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 19.7 10M4.3 14A8 8 0 0 0 17.9 17.9',
    settings: 'M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M10 14v6',
    folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z',
    arrow: 'M19 12H5m6-6-6 6 6 6', plus: 'M12 5v14M5 12h14',
    globe: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM3 12h18M12 3c4 4 4 14 0 18-4-4-4-14 0-18Z',
    history: 'M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2',
    check: 'm5 12 4 4L19 6', chat: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z',
    arrowOut: 'M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  };
  return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }, h('path', { d: paths[name] || paths.memory, stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round' }));
}
const asText = value => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
const previewText = value => asText(value).replace(/^#{1,6}\s+/gm, '').replace(/\*\*|__/g, '').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
const entry = memory => ({ ...memory, ...(memory.content || {}) });
const date = (value, t) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString(t('formatLocale'), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const statusLabel = (status, t) => Object.hasOwn(zh, status) ? t(status) : String(status || t('unknown'));
function Markdown({ text, t }) {
  if (typeof NativeMarkdown === 'undefined' || asText(text).includes('![')) return h('div', { className: 'dam-prose dam-plain-text' }, text);
  return h('div', { className: 'dam-prose' }, h(NativeMarkdown, { text: asText(text), labels: { code: { copyLabel: t('copy'), copiedLabel: t('copied'), toolbarLabels: { codeLabel: t('code'), wrapLabel: t('wrap'), unwrapLabel: t('unwrap') } }, footnotes: t('footnotes') } }));
}
function Empty({ icon = 'memory', title, description, children }) {
  return h('div', { className: 'dam-empty-state' }, h('span', { className: 'dam-empty-icon' }, h(Icon, { name: icon, size: 28 })), h('h3', null, title), description ? h('p', null, description) : null, children);
}
function Sources({ refs = [], t }) {
  if (!refs.length) return null;
  return h('details', { className: 'dam-disclosure' }, h('summary', null, t('sources'), h('span', { className: 'dam-count' }, refs.length)), h('ul', { className: 'dam-sources' }, ...refs.map((ref, i) => {
    const label = typeof ref === 'string' ? ref : ref.locator || ref.path || ref.sessionId || asText(ref);
    return h('li', { key: i }, /^https?:\/\//i.test(label) ? h('a', { href: label, target: '_blank', rel: 'noreferrer noopener' }, label) : label);
  })));
}
function Receipt({ value, t, onClose, openSession }) {
  if (!value) return null;
  const r = receiptPresentation(value);
  return h('section', { className: 'dam-notice', 'data-tone': r.tone, role: r.tone === 'error' ? 'alert' : 'status', 'aria-live': 'polite' },
    h('div', { className: 'dam-row' }, h('strong', null, statusLabel(r.status, t)), h('button', { className: 'dam-icon', onClick: onClose, 'aria-label': t('close') }, h(Icon, { name: 'close', size: 16 }))),
    r.cleanup === 'incomplete' || r.cleanup === 'pending' ? h('p', null, t(r.cleanup === 'incomplete' ? 'cleanupIncomplete' : 'cleanupPending')) : null,
    h('details', { className: 'dam-disclosure' }, h('summary', null, t('viewDetails')), r.message ? h('p', null, r.message) : null, r.scope ? h('p', null, r.scope) : null, r.requestId ? h('p', { className: 'dam-mono' }, r.requestId) : null, r.jobId ? h('p', { className: 'dam-mono' }, r.jobId) : null),
    ...r.errors.map((error, i) => h('p', { key: i }, errorText(error, t))));
}
export function filterMemories(items = [], category = 'all', query = '') {
  const term = query.trim().toLocaleLowerCase();
  return items.map(entry).filter(m => (category === 'history' ? m.status !== 'current' : m.status === 'current' && (category === 'all' || m.category === category)) && (!term || [m.title, m.group, m.index_hint].join(' ').toLocaleLowerCase().includes(term))).sort((a, b) => (a.category === b.category ? 0 : a.category === 'active' ? -1 : 1) || (Number(b.updated_at) - Number(a.updated_at)) || String(a.title).localeCompare(String(b.title)));
}
function MemoryContent({ record, fallback, t }) {
  const c = record?.content, payload = c?.payload;
  if (!c) return h(Markdown, { text: fallback || t('readFailed'), t });
  return h(React.Fragment, null,
    c.conditions ? h('section', { className: 'dam-conditions' }, h('h3', null, t('conditions')), h('p', null, c.conditions)) : null,
    payload?.kind === 'markdown' ? h(Markdown, { text: payload.text, t }) : payload ? h('div', { className: 'dam-task-content' }, h(Markdown, { text: payload.goal, t }), ...['progress', 'blockers', 'next_actions'].map(key => payload[key]?.length ? h('section', { key }, h('h3', null, t(key)), h('ul', null, ...payload[key].map((value, i) => h('li', { key: i }, value)))) : null), h(Sources, { refs: payload.references, t })) : null);
}
function Change({ item, t, showReview = false }) {
  const before = item.before ?? item.diff?.before, after = item.after ?? item.diff?.after;
  return h('article', { className: 'dam-change' }, h('div', { className: 'dam-change-marker' }, h(Icon, { name: 'check', size: 15 })), h('div', { className: 'dam-change-content' },
    h('div', { className: 'dam-row' }, h('h3', null, item.summary || item.reason || item.message || t('committed')), h('time', null, date(item.time ?? item.created_at ?? item.createdAt, t))), item.summary && item.reason ? h('p', { className: 'dam-hint' }, item.reason) : null,
    before != null || after != null ? h('details', { className: 'dam-disclosure' }, h('summary', null, t('viewChanges')), h('div', { className: 'dam-diff' }, h('div', null, h('h4', null, t('before')), h(Markdown, { text: asText(before), t })), h('div', null, h('h4', null, t('after')), h(Markdown, { text: asText(after), t })))) : null,
    h(Sources, { refs: item.source_refs || item.sources || [], t }), showReview && item.review ? h('details', { className: 'dam-disclosure' }, h('summary', null, t('review')), h('p', { className: 'dam-hint' }, t('reviewHint')), h('pre', { className: 'dam-body' }, asText(item.review))) : null));
}
/** Nonblank evidence is monotonic; a cold list's default false is not evidence. */
export function historySessionBlank(item, native) {
  const projected = native?.projectionValues?.sessionListMetadata?.blank;
  if (native?.running === true || projected === false || item.blankKnown === true && item.blank === false) return false;
  if (item.blankKnown === true) return typeof item.blank === 'boolean' ? item.blank : undefined;
  if (item.blankKnown === false) return undefined;
  // Compatibility with hosts predating explicit blankKnown. Positive projection
  // facts remain useful; do not derive blankness from a display title.
  if (typeof projected === 'boolean') return projected;
  return typeof native?.blank === 'boolean' ? native.blank : item.blank;
}

/** Blank is a host fact, not inferred from an absent title or an identifier. */
export function historySessionGroups(items = [], nativeSessions = {}, t, filter = '') {
  const sessions = [], seen = new Set();
  const identifierTitle = value => /^(?:session-)?[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const native = nativeSessions[item.id];
    const blank = historySessionBlank(item, native);
    if (blank === true) continue;
    // Native displayTitle may be just the cwd basename while title metadata is cold.
    // Actual authored/projected titles take precedence over that presentation fallback.
    const cwdName = typeof native?.cwd === 'string' ? native.cwd.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) : null;
    const displayTitle = typeof native?.displayTitle === 'string' && native.displayTitle.trim() !== cwdName ? native.displayTitle : null;
    const candidates = [native?.title, native?.projectionValues?.title, item.title, displayTitle].filter(value => typeof value === 'string').map(value => value.trim());
    const savedTitle = candidates.find(value => value && value !== item.id && !identifierTitle(value));
    const updatedAt = native?.updatedAt || item.updatedAt || item.createdAt;
    const when = date(updatedAt, t);
    const title = savedTitle || t('untitledConversation') + (when ? ' · ' + when : '');
    sessions.push({ ...item, title, titleIsFallback: !savedTitle, updatedAt, blank, included: item.included === true });
  }
  const term = filter.trim().toLocaleLowerCase();
  const visible = sessions.filter(session => !term || session.title.toLocaleLowerCase().includes(term));
  return { sessions, selectable: visible.filter(session => !session.included), covered: visible.filter(session => session.included) };
}
export async function includeHistorySelection({ sessionIds, act, isCurrent, onViewStateChange }) {
  const submitted = [...sessionIds];
  const result = await act('include-sessions', { sessionIds: submitted });
  if (result && isCurrent()) onViewStateChange(current => ({ ...current, selectedIds: (current.selectedIds || []).filter(id => !submitted.includes(id)) }));
  return result;
}
function PastSessions({ data, nativeSessions, act, busy, t, viewState = {}, onViewStateChange }) {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const selected = new Set(viewState.selectedIds || []), filter = viewState.filter || '';
  const groups = historySessionGroups(data.sessions || [], nativeSessions, t, filter);
  const selectedIds = groups.sessions.filter(session => selected.has(session.id) && !session.included).map(session => session.id);
  const change = patch => onViewStateChange(current => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }));
  const caption = session => h('span', null, h('strong', null, session.title), !session.titleIsFallback && date(session.updatedAt, t) ? h('span', { className: 'dam-muted' }, date(session.updatedAt, t)) : null);
  return h('div', { className: 'dam-history-picker' },
    h('div', { className: 'dam-search' }, h(Icon, { name: 'search', size: 16 }), h('input', { type: 'search', value: filter, placeholder: t('sessionFilter'), 'aria-label': t('sessionFilter'), onChange: event => change({ filter: event.target.value }) })),
    data.capabilities?.includeSessions === false && groups.sessions.some(session => !session.included) ? h('p', { className: 'dam-inline-status', role: 'status' }, t('historyPausedHint')) : null,
    groups.selectable.length ? h('section', { className: 'dam-history-group', 'aria-label': t('historySelectable') }, h('div', { className: 'dam-row' }, h('h4', null, t('historySelectable')), h('span', { className: 'dam-muted' }, t('sessionCount', { count: groups.selectable.length }))), h('div', { className: 'dam-list' }, ...groups.selectable.map(session => h('label', { key: session.id, className: 'dam-session-choice' }, h('input', { type: 'checkbox', checked: selected.has(session.id), disabled: busy || data.capabilities?.includeSessions === false, 'aria-label': t('selectSession', { title: session.title }), onChange: event => { const checked = event.target.checked; change(current => { const next = new Set(current.selectedIds || []); checked ? next.add(session.id) : next.delete(session.id); return { selectedIds: [...next] }; }); } }), caption(session))))) : null,
    groups.covered.length ? h('section', { className: 'dam-history-group dam-history-covered', 'aria-label': t('historyCovered') }, h('div', { className: 'dam-row' }, h('h4', null, t('historyCovered')), h('span', { className: 'dam-muted' }, t('sessionCount', { count: groups.covered.length }))), h('p', { className: 'dam-hint' }, t('historyCoveredHint')), h('div', { className: 'dam-list' }, ...groups.covered.map(session => h('article', { key: session.id, className: 'dam-covered-session' }, h(Icon, { name: 'check', size: 17 }), caption(session), h('span', { className: 'dam-badge' }, t('included')))))) : null,
    !groups.selectable.length && !groups.covered.length ? h(Empty, { icon: 'chat', title: filter ? t('noMatchingSessions') : t('emptySessions') }) : null,
    groups.sessions.some(session => !session.included) ? h('div', { className: 'dam-settings-actions' }, h('span', { className: 'dam-muted' }, t('selectedCount', { count: selectedIds.length })), h('button', { className: 'dam-button primary', disabled: busy || !selectedIds.length || data.capabilities?.includeSessions === false, onClick: () => includeHistorySelection({ sessionIds: selectedIds, act, isCurrent: () => mounted.current, onViewStateChange }) }, t('includeSelected', { count: selectedIds.length }))) : null);
}
function Settings({ data, act, busy, t }) {
  const [form, setForm] = useState(data.settings || {}), [dirty, setDirty] = useState(false), [error, setError] = useState(null);
  useEffect(() => { if (!dirty) setForm(data.settings || {}); }, [data.settings, dirty]);
  const change = (key, value) => { setDirty(true); setError(null); setForm(old => ({ ...old, [key]: value })); };
  const modelChange = (role, key, value) => change('models', { ...form.models, [role]: { ...form.models?.[role], [key]: value } });
  const modelFields = role => ['provider', 'model'].map(key => {
    const choices = [...new Set((data.models || []).filter(m => key === 'provider' || !form.models?.[role]?.provider || m.provider === form.models[role].provider).map(m => m[key]))];
    return h('label', { className: 'dam-field', key }, h('span', null, t(key)), h('input', { value: form.models?.[role]?.[key] || '', required: role !== 'g2', list: 'dam-' + role + '-' + key, onChange: e => modelChange(role, key, e.target.value), autoComplete: 'off' }), h('datalist', { id: 'dam-' + role + '-' + key }, ...choices.map(value => h('option', { key: value, value }))));
  });
  const number = (key, min, max, budget = false) => h('label', { className: 'dam-field', key }, h('span', null, t(key)), h('input', { type: 'number', min, max, required: true, value: (budget ? form.budget?.[key] : form[key]) ?? '', onChange: e => budget ? change('budget', { ...form.budget, [key]: e.target.value }) : change(key, e.target.value) }));
  return h('form', { className: 'dam-section dam-secondary-panel dam-settings', onSubmit: async e => { e.preventDefault(); setError(null); try { const result = await act('settings-save', { settings: normaliseSettings(form) }); if (result) setDirty(false); } catch (err) { if (err.params?.field) err.params.field = t(err.params.field); setError(err); } } },
    h('div', { className: 'dam-section-head' }, h('div', null, h('h2', null, t('settings')), h('p', { className: 'dam-hint' }, t('settingsIntro')))),
    h('fieldset', { className: 'dam-fieldset', disabled: busy }, h('legend', null, t('generalSettings')), h('div', { className: 'dam-fields' }, h('div', null, number('dreamIntervalHours', 24, 8760), h('p', { className: 'dam-hint' }, t('intervalHint'))), h('div', null, number('auditRetentionDays', 1, 3650), h('p', { className: 'dam-hint' }, t('retentionHint'))))),
    h('fieldset', { className: 'dam-fieldset', disabled: busy }, h('legend', null, t('models')), h('p', { className: 'dam-hint' }, t('modelsHint')), ...['manager', 'g2', 'dreamer', 'reviewer'].map(role => h('div', { key: role, className: 'dam-model-row' }, h('div', null, h('strong', null, t(role)), h('p', { className: 'dam-hint' }, t(role === 'g2' ? 'followSession' : 'chooseModel'))), h('div', { className: 'dam-fields' }, ...modelFields(role))))),
    h('details', { className: 'dam-disclosure dam-advanced' }, h('summary', null, t('advanced')), h('fieldset', { className: 'dam-fieldset', disabled: busy }, h('legend', null, t('budgets')), h('p', { className: 'dam-hint' }, t('budgetEstimateHint')), h('div', { className: 'dam-fields' }, number('maxInputTokens', 1024, 2000000, true), number('maxOutputTokens', 128, 32768, true), number('maxSteps', 1, 32, true), number('maxDailyTokens', 1024, 100000000, true)))),
    error ? h('p', { className: 'dam-error', role: 'alert' }, errorText(error, t)) : null,
    h('div', { className: 'dam-settings-actions' }, h('button', { type: 'submit', className: 'dam-button primary', disabled: busy || !dirty }, t('save'))));
}
/** Scope-bound management lifecycle. Late replies never attach to a new visit. */
export function createManagerChannel({ request, onChange, timers = globalThis, pollMs = 900, newId = () => crypto.randomUUID() }) {
  let closed = false, timer, conversation, opening, reading = false, delivery = null, retryId = null;
  const receive = value => {
    const next = value?.conversation || value;
    const id = next?.id || next?.conversationId;
    if (!id || (conversation && id !== conversation.id)) throw failure('sessionMismatch');
    conversation = { ...next, id };
    if (delivery && next.diagnostics?.requestId?.endsWith(':' + delivery.requestId)) delivery.acknowledged = true;
    if (retryId && next.diagnostics?.requestId?.endsWith(':' + retryId)) retryId = null;
    if (!closed) onChange(conversation);
    return conversation;
  };
  const refresh = async () => {
    if (closed || !conversation || reading) return;
    reading = true;
    try { receive(await request('manager-state', { conversationId: conversation.id })); }
    catch (error) { if (!closed) onChange({ ...conversation, connectionError: error }); }
    finally { reading = false; }
  };
  const start = () => {
    if (opening) return opening;
    opening = request('manager-open', { requestId: newId() }).then(async value => {
      receive(value);
      if (closed) { await request('manager-close', { conversationId: conversation.id }).catch(() => {}); return; }
      timer = timers.setInterval(() => { if (['running', 'queued', 'working'].includes(conversation?.status)) void refresh(); }, pollMs);
      return conversation;
    }).catch(error => { opening = null; if (!closed) onChange({ error, status: 'error', messages: [] }); });
    return opening;
  };
  return {
    start, refresh,
    async send(text, context = {}) {
      if (closed || !conversation) throw failure('unavailable');
      const payload = JSON.stringify({ text, context });
      if (delivery && delivery.payload !== payload) { if (!delivery.acknowledged) throw failure('deliveryUnconfirmed'); delivery = null; }
      delivery ||= { payload, requestId: newId() };
      const value = await request('manager-send', { ...context, conversationId: conversation.id, text, requestId: delivery.requestId });
      delivery = null;
      if (!closed) receive(value);
      return value;
    },
    async retry() {
      if (closed || !conversation) throw failure('unavailable');
      retryId ||= newId();
      const value = await request('manager-retry', { conversationId: conversation.id, requestId: retryId });
      retryId = null;
      if (!closed) receive(value);
      return value;
    },
    async confirm(confirmationId, approved) {
      if (closed || !conversation) throw failure('unavailable');
      const value = await request('manager-confirm', { conversationId: conversation.id, confirmationId, approved });
      if (!closed) receive(value);
      return value;
    },
    dispose() {
      if (closed) return; closed = true;
      if (timer !== undefined) timers.clearInterval(timer);
      if (conversation) void request('manager-close', { conversationId: conversation.id }).catch(() => {});
    },
  };
}
export function workspaceProjects(projects, snapshot) {
  if (!snapshot) return projects;
  return snapshot.map(w => {
    const project = projects.find(p => p.nativeWorkspaceId === w.workspaceId);
    return project ? { ...project, key: w.workspaceId, name: w.title, path: w.path,
      sessions: (project.sessions || []).filter(s => w.sessionIds.includes(s.id)) }
      : { key: w.workspaceId, nativeWorkspaceId: w.workspaceId, id: null, name: w.title, path: w.path, canBrowse: false, sessions: [] };
  });
}
export function visibleMemoryActivity(items = []) {
  return items.filter(item => item.status === 'committed' && item.changed === true && (item.before != null || item.after != null || item.diff || ['overview.organized', 'issue.resolved'].includes(item.event_type)));
}
function Loading({ t }) { return h('div', { className: 'dam-loading', role: 'status' }, h('span', { className: 'dam-spinner' }), t('loading')); }
function ErrorNotice({ error, retry, t }) {
  return error ? h('div', { className: 'dam-error', role: 'alert' }, h('p', null, errorText(error, t)), retry ? h('button', { className: 'dam-button', onClick: retry }, t('refreshStatus')) : null) : null;
}
export function managerRetryLabel(mode) { return mode === 'review' ? 'reviewResult' : 'resendRequest'; }
export function managerErrorMessage(error, t) {
  if (!error?.requestId) return errorText(error, t);
  const keys = { AUTH: 'managerAuthError', RATE_LIMIT: 'managerRateLimitError', MODEL_BUDGET_EXCEEDED: 'managerBudgetError', MODEL_INPUT_BUDGET: 'managerContextError', MANAGEMENT_TIMEOUT: 'managerTimeoutError', MANAGEMENT_STEP_LIMIT: 'managerStepError' };
  return t(keys[error.code] || 'managerFailure');
}
function ManagerFailure({ error, diagnostics, retry, onRefresh, onRetry, disabled, t }) {
  if (!error) return null;
  return h('section', { className: 'dam-error', role: 'alert' }, h('p', null, managerErrorMessage(error, t)),
    diagnostics?.writes === 'committed' ? h('p', null, t('managerWritesCommitted')) : diagnostics?.writes === 'uncertain' ? h('p', null, t('managerWritesUncertain')) : null,
    h('div', { className: 'dam-header-actions' }, h('button', { className: 'dam-button', disabled, onClick: onRefresh }, t('refreshStatus')), retry ? h('button', { className: 'dam-button', disabled, onClick: onRetry }, t(managerRetryLabel(retry.mode))) : null),
    diagnostics ? h('details', { className: 'dam-disclosure' }, h('summary', null, t('failureDetails')),
      h('dl', { className: 'dam-metadata' }, h('dt', null, t('failureCode')), h('dd', null, diagnostics.error?.code || error.code || t('unknown')), h('dt', null, t('failureStage')), h('dd', null, t('managerStage_' + (diagnostics.error?.stage || diagnostics.stage || 'prepare'))), h('dt', null, t('model')), h('dd', null, [diagnostics.provider, diagnostics.model].filter(Boolean).join(' / ') || t('unknown')), h('dt', null, t('requestId')), h('dd', null, diagnostics.requestId), diagnostics.error?.httpStatus ? h(React.Fragment, null, h('dt', null, 'HTTP'), h('dd', null, diagnostics.error.httpStatus)) : null),
      (diagnostics.calls || []).length ? h('ol', null, ...diagnostics.calls.map((item, index) => h('li', { key: index }, [item.step ? t('managerStep', { step: item.step }) : '', item.tool || t('managerModelCall'), item.kind === 'model-finish' ? item.finish : item.status || '', item.code || ''].filter(Boolean).join(' · ')))) : null) : null);
}
function useMemoryState(workspaceId) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false), [receipt, setReceipt] = useState(null);
  const mounted = useRef(false), pending = useRef(null), generation = useRef(0);
  const refresh = useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; const seq = ++generation.current;
    try { const value = await apiRequest(workspaceId ? { workspaceId } : null, null, {}, controller.signal); if (mounted.current && !controller.signal.aborted && seq === generation.current) { setData(value); setError(null); } }
    catch (error) { if (mounted.current && !controller.signal.aborted) setError(error); }
  }, [workspaceId]);
  useEffect(() => {
    mounted.current = true; void refresh();
    const wake = () => { if (!document.hidden) void refresh(); }; const timer = setInterval(wake, 15000);
    window.addEventListener('focus', wake); document.addEventListener('visibilitychange', wake);
    return () => { mounted.current = false; pending.current?.abort(); clearInterval(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [refresh]);
  const act = async (action, params = {}, options = {}) => {
    setBusy(true); setError(null);
    try {
      const value = await apiRequest(options.scope ?? (workspaceId ? { workspaceId } : null), action, params);
      if (mounted.current) { if (options.receipt !== false) setReceipt(value); if (options.refresh !== false) await refresh(); }
      return value;
    } catch (err) { if (mounted.current) setError(err); if (options.receipt === false) throw err; return null; }
    finally { if (mounted.current) setBusy(false); }
  };
  return { data, error, busy, act, refresh, receipt, clearReceipt: () => setReceipt(null) };
}
function ManagerChat({ workspaceId, nativeWorkspaceId, userScope, context, contextLabel, t, onUpdated, focusRequest }) {
  const [conversation, setConversation] = useState(null), [text, setText] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState(null);
  const channel = useRef(null), field = useRef(null), chatLog = useRef(null), updated = useRef(onUpdated), previous = useRef('');
  updated.current = onUpdated;
  useEffect(() => {
    const connection = createManagerChannel({
      request: (action, params) => apiRequest(workspaceId ? { workspaceId } : null, action, { ...params, scope: userScope ? 'user' : 'project', ...(action === 'manager-open' && !userScope && nativeWorkspaceId ? { nativeWorkspaceId } : {}) }),
      onChange: next => {
        setConversation(next);
        const signature = JSON.stringify([next.status, next.messages?.length, next.revision, next.updatedAt]);
        if (previous.current && signature !== previous.current && !['running', 'queued'].includes(next.status)) void updated.current?.();
        previous.current = signature;
      },
    });
    channel.current = connection; void connection.start();
    return () => { channel.current = null; connection.dispose(); };
  }, [workspaceId, nativeWorkspaceId, userScope]);
  useEffect(() => { if (focusRequest) field.current?.focus(); }, [focusRequest]);
  const messages = conversation?.messages || [];
  useEffect(() => { if (messages.length && chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight; }, [messages.length, conversation?.status]);
  const pending = sending || ['running', 'queued', 'working'].includes(conversation?.status);
  const confirmation = conversation?.confirmation || conversation?.pendingConfirmation;
  const send = async e => {
    e.preventDefault(); if (!text.trim() || pending || !conversation?.id || confirmation) return;
    setSending(true); setError(null);
    try { await channel.current.send(text.trim(), context || {}); setText(''); }
    catch (err) { setError(err); }
    finally { setSending(false); }
  };
  return h('aside', { className: 'dam-manager', 'aria-label': t('managerTitle') },
    h('header', { className: 'dam-manager-header' }, h(Icon, { name: 'chat', size: 19 }), h('div', null, h('h2', null, t('managerTitle')), h('p', null, t('managerSubtitle')))),
    h('div', { ref: chatLog, className: 'dam-chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': t('managerMessages') },
      !messages.length ? h('div', { className: 'dam-chat-welcome' }, h(Icon, { name: 'memory', size: 27 }), h('h3', null, t('managerWelcome')), h('p', null, t(userScope ? 'managerWelcomeUser' : 'managerWelcomeProject')),
        h('div', { className: 'dam-chat-suggestions' }, ...(userScope ? ['profileSuggestion'] : ['explainSuggestion', 'organizeSuggestion']).map(key => h('button', { key, className: 'dam-button', onClick: () => { setText(t(key)); field.current?.focus(); } }, t(key))))) : null,
      ...messages.filter(message => ['user', 'assistant'].includes(message.role)).map((message, i) => h('article', { key: message.id || i, className: 'dam-chat-message', 'data-role': message.role }, h('span', { className: 'dam-sr-only' }, t(message.role === 'user' ? 'you' : 'memoryAssistant')), h(Markdown, { text: message.text || message.content?.filter?.(x => x.type === 'text').map(x => x.text).join('\n') || '', t }), message.status === 'failed' ? h('span', { className: 'dam-muted' }, t('failed')) : null)),
      pending ? h('div', { className: 'dam-chat-progress', role: 'status' }, h('span', { className: 'dam-spinner' }), t('managerWorking')) : null,
      confirmation ? h('section', { className: 'dam-chat-confirm' }, h('strong', null, t('confirmMemoryChange')), h('p', null, confirmation.message || confirmation.description || t('confirmMemoryChangeHint')), h('div', { className: 'dam-header-actions' }, ...[[false, 'cancel'], [true, 'confirmAction']].map(([approved, label]) => h('button', { key: label, className: 'dam-button' + (approved ? ' primary' : ''), disabled: sending, onClick: async () => { setSending(true); try { await channel.current.confirm(confirmation.id || confirmation.confirmationId, approved); } catch (err) { setError(err); } finally { setSending(false); } } }, t(label))))) : null,
      h(ManagerFailure, { error: error || conversation?.connectionError || conversation?.error, diagnostics: conversation?.diagnostics, retry: !confirmation ? conversation?.retry : null, disabled: pending, onRefresh: () => { setError(null); return conversation?.id ? channel.current?.refresh() : channel.current?.start(); }, onRetry: async () => { if (pending || confirmation) return; setSending(true); setError(null); try { await updated.current?.(); await channel.current?.retry(); } catch (err) { setError(err); } finally { setSending(false); } }, t })),
    h('form', { className: 'dam-chat-composer', onSubmit: send }, h('div', { className: 'dam-chat-scope' }, h(Icon, { name: context?.issueId ? 'chat' : 'folder', size: 14 }), h('span', null, contextLabel)),
      h('textarea', { ref: field, rows: 3, value: text, onChange: e => setText(e.target.value), placeholder: t(userScope ? 'profileChatPlaceholder' : 'managerPlaceholder'), 'aria-label': t('managerInput'), disabled: !conversation?.id || sending, onKeyDown: e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(e); } }),
      h('div', { className: 'dam-chat-send-row' }, h('span', { className: 'dam-muted' }, t('managerScopeHint')), h('button', { type: 'submit', className: 'dam-button primary', disabled: !text.trim() || pending || !conversation?.id || !!confirmation }, t('send')))));
}
function MemoryRecord({ memory, act, t, onDiscuss }) {
  const [open, setOpen] = useState(false), [loaded, setLoaded] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setLoaded(null); setOpen(false); }, [memory.id, memory.version]);
  useEffect(() => () => { generation.current++; }, []);
  const read = async () => {
    setOpen(value => !value); if (open || loaded) return;
    const seq = ++generation.current; setLoading(true); setError(null);
    try { const result = await act('read', { ids: [memory.id], include_noncurrent: true }, { receipt: false, refresh: false }); if (seq === generation.current) setLoaded(result.items?.[0]); }
    catch (error) { if (seq === generation.current) setError(error); }
    finally { if (seq === generation.current) setLoading(false); }
  };
  const m = entry(memory), record = loaded?.record;
  return h('article', { className: 'dam-record', 'data-expanded': open }, h('button', { className: 'dam-record-head', onClick: read, 'aria-expanded': open }, h('span', null, h('strong', null, m.title || t('untitledMemory')), m.index_hint ? h('span', { className: 'dam-muted' }, m.index_hint) : null), h('span', { className: 'dam-record-chevron', 'aria-hidden': true }, '›')),
    open ? h('div', { className: 'dam-record-body' }, loading ? h(Loading, { t }) : null, h(ErrorNotice, { error, t }), loaded ? h(React.Fragment, null, memory.status !== 'current' ? h('p', { className: 'dam-muted' }, statusLabel(memory.status, t), ' · ', t('historyHint')) : null, h(MemoryContent, { record, fallback: loaded.markdown, t }), h('footer', { className: 'dam-record-footer' }, h('button', { className: 'dam-button', onClick: () => onDiscuss({ memoryId: memory.id, label: m.title }) }, h(Icon, { name: 'chat', size: 15 }), t('discussMemory')), h(Sources, { refs: record?.source_refs, t })), h('details', { className: 'dam-disclosure' }, h('summary', null, t('details')), h('dl', { className: 'dam-metadata' }, h('dt', null, t('version')), h('dd', null, record?.version || memory.version), h('dt', null, t('lastUpdated')), h('dd', null, date(record?.updated_at || memory.updated_at, t)), h('dt', null, 'ID'), h('dd', { className: 'dam-mono' }, memory.id)))) : null) : null);
}
function Overview({ data, selected, onSelect, onDiscuss, act, t }) {
  const [query, setQuery] = useState(''), [showAll, setShowAll] = useState(false), [category, setCategory] = useState('all');
  const overview = data.overview || {}, topics = overview.topics || [], issues = (data.issues || []).filter(x => x.status !== 'resolved');
  const topic = selected?.topicId ? topics.find(x => x.id === selected.topicId) : null;
  const issue = selected?.issueId ? issues.find(x => x.id === selected.issueId) : null;
  const current = (data.memories || []).filter(x => x.status === 'current');
  const relevant = topic ? (data.memories || []).filter(m => topic.memoryIds?.includes(m.id)) : data.memories || [];
  const filtered = filterMemories(relevant, category, query);
  return h('section', { className: 'dam-overview' },
    (topic || issue || showAll) ? h('button', { className: 'dam-button dam-overview-back', onClick: () => { onSelect(null); setShowAll(false); setQuery(''); setCategory('all'); } }, h(Icon, { name: 'arrow', size: 15 }), t('projectOverview')) : null,
    issue ? h('article', { className: 'dam-issue-detail' }, h('p', { className: 'dam-eyebrow' }, t('needsDecision')), h('h2', null, issue.question || issue.title || t('needsDecision')), issue.context ? h(Markdown, { text: asText(issue.context), t }) : null, h(Sources, { refs: issue.source_refs || issue.sources, t }), h('p', { className: 'dam-hint' }, t('issueChatHint')), h('button', { className: 'dam-button', onClick: () => onDiscuss({ issueId: issue.id, label: issue.question || issue.title }) }, h(Icon, { name: 'chat', size: 16 }), t('discussIssue'))) : h(React.Fragment, null,
      h('div', { className: 'dam-overview-heading' }, h('p', { className: 'dam-eyebrow' }, t(topic ? 'topicMemory' : showAll ? 'allMemories' : 'projectOverview')), h('h2', null, topic?.title || (showAll ? t('allMemories') : t('overviewTitle'))), h('p', { className: 'dam-muted' }, t('memoryCount', { count: topic ? relevant.filter(m => m.status === 'current').length : current.length }))),
      !showAll ? (topic?.summary || overview.summary) ? h('div', { className: 'dam-overview-summary' }, h(Markdown, { text: topic?.summary || overview.summary, t })) : h('p', { className: 'dam-overview-empty' }, t(current.length ? 'overviewPending' : 'overviewEmpty')) : null,
      overview.stale ? h('p', { className: 'dam-hint' }, t('overviewStale')) : null,
      !topic && !showAll && issues.length ? h('section', { className: 'dam-issues-inline' }, h('h3', null, t('showIssues', { count: issues.length })), ...issues.map(i => h('button', { className: 'dam-issue-row', key: i.id, onClick: () => { onSelect({ issueId: i.id, label: i.question || i.title }); onDiscuss({ issueId: i.id, label: i.question || i.title }); } }, h(Icon, { name: 'chat', size: 16 }), h('span', null, i.question || i.title || t('needsDecision')), h('span', { 'aria-hidden': true }, '›')))) : null,
      !topic && !showAll ? h('section', { className: 'dam-topics' }, h('div', { className: 'dam-row' }, h('h3', null, t('topics')), h('button', { className: 'dam-button subtle', onClick: () => setShowAll(true) }, t('allMemories'))), topics.length ? h('div', { className: 'dam-topic-grid' }, ...topics.map(item => h('button', { className: 'dam-topic-card', key: item.id, onClick: () => onSelect({ topicId: item.id, label: item.title }) }, h('div', { className: 'dam-row' }, h(Icon, { name: 'folder', size: 19 }), h('span', { className: 'dam-muted' }, t('memoryCount', { count: item.memoryIds?.length || 0 }))), h('h3', null, item.title), h('p', null, previewText(item.summary) || t('topicRead')), h('span', { className: 'dam-topic-open' }, t('viewTopic'), ' →')))) : current.length ? h('p', { className: 'dam-hint' }, t('overviewPending')) : h('div', { className: 'dam-empty-topics' }, h(Icon, { size: 25 }), h('p', null, t('topicEmpty')))) : null,
      topic || showAll ? h('section', { className: 'dam-topic-records' }, h('div', { className: 'dam-library-toolbar' }, h('div', { className: 'dam-search' }, h(Icon, { name: 'search', size: 16 }), h('input', { type: 'search', value: query, onChange: e => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') })), showAll ? h('div', { className: 'dam-filters', role: 'group', 'aria-label': t('allMemories') }, ...['all', 'history'].map(key => h('button', { key, 'aria-pressed': category === key, onClick: () => setCategory(key) }, t(key)))) : null), filtered.length ? filtered.map(memory => h(MemoryRecord, { key: memory.id, memory, act, t, onDiscuss })) : h(Empty, { title: query ? t('noMatches') : category === 'history' ? t('emptyHistory') : t('emptyMemories'), description: null })) : null));
}
function Activity({ data, act, busy, t, onDiscuss }) {
  const activity = visibleMemoryActivity(data.activity).map(item => ({ ...item, summary: item.event_type === 'overview.organized' ? t('topicsOrganized', { count: item.metadata?.topic_count ?? '—' }) : item.event_type === 'issue.resolved' ? t('issueResolved') : item.summary }));
  return h('section', { className: 'dam-section dam-memory-activity' }, h('div', { className: 'dam-section-head' }, h('div', null, h('h2', null, t('memoryActivity')), h('p', { className: 'dam-hint' }, t('memoryActivityIntro'))), h('button', { className: 'dam-button', disabled: busy || data.capabilities?.dream === false, onClick: () => act('dream') }, h(Icon, { name: 'refresh', size: 15 }), t('dream'))),
    activity.length ? h('div', { className: 'dam-timeline' }, ...activity.map((item, index) => h('div', { key: item.id || index }, h('span', { className: 'dam-activity-origin' }, t(({ G1: 'ordinaryUpdate', G2: 'stageUpdate', MEMORY_UI: 'requestedUpdate', DREAMING: 'automaticUpdate' })[item.channel] || 'ordinaryUpdate')), h(Change, { item, t, showReview: true }), h('button', { className: 'dam-button subtle', onClick: () => onDiscuss({ memoryId: item.memoryId || item.memory_id, label: item.summary, activityId: item.id }) }, t('askAboutChange'))))) : h(Empty, { icon: 'history', title: t('emptyMemoryActivity'), description: t('emptyMemoryActivityHint') }),
    (data.jobs || []).length ? h('details', { className: 'dam-disclosure dam-diagnostics' }, h('summary', null, t('recentConsolidations')), ...data.jobs.map(job => h('article', { key: job.id, className: 'dam-card' }, h('div', { className: 'dam-row' }, h('strong', null, t(job.kind === 'DREAMING' ? 'automaticUpdate' : 'stageUpdate')), h('span', { className: 'dam-badge' }, jobPresentation(job, t).label)), jobPresentation(job, t).message ? h('p', { className: 'dam-hint' }, jobPresentation(job, t).message) : null, h('details', { className: 'dam-disclosure' }, h('summary', null, t('details')), h('dl', { className: 'dam-usage' }, ...usagePresentation(job.usage, t).map(metric => h('div', { key: metric.key }, h('dt', null, metric.label), h('dd', null, metric.value)))), job.error || jobPresentation(job, t).waiting ? h('pre', { className: 'dam-body' }, errorText(job.error || job.deferral, t)) : null)))) : null);
}
function WorkspacePage({ project, userScope = false, t, onBack, backLabel, onSettings, onContentReady }) {
  const { data, error, busy, act, refresh, receipt, clearReceipt } = useMemoryState(userScope ? null : project.id);
  useEffect(() => { if (data || error) onContentReady?.(); }, [!!data, !!error, onContentReady]);
  const [view, setView] = useState('current'), [selection, setSelection] = useState(null), [context, setContext] = useState(null), [focusRequest, setFocusRequest] = useState(0), [mobilePane, setMobilePane] = useState('memory');
  const contextValid = !context || (!context.topicId || data?.overview?.topics?.some(topic => topic.id === context.topicId)) && (!context.issueId || data?.issues?.some(issue => issue.id === context.issueId && issue.status !== 'resolved')) && (!context.memoryId || data?.memories?.some(memory => memory.id === context.memoryId));
  useEffect(() => { if (data && !contextValid) { setContext(null); setSelection(null); } }, [contextValid, data]);
  const discuss = next => { setContext({ ...(next.issueId || next.activityId ? {} : selection || {}), ...next }); setFocusRequest(value => value + 1); setMobilePane('chat'); };
  const tabs = userScope ? ['current', 'activity'] : ['current', 'activity'];
  return h(React.Fragment, null,
    h('header', { className: 'dam-workspace-header' }, h('div', null, h('button', { className: 'dam-button subtle dam-breadcrumb', onClick: onBack }, h(Icon, { name: 'arrow', size: 15 }), backLabel || t('backToWorkspaces')), h('div', { className: 'dam-workspace-title' }, h(Icon, { name: userScope ? 'globe' : 'folder', size: 22 }), h('h1', null, userScope ? t('profile') : project.name))), h('button', { className: 'dam-button', onClick: onSettings }, h(Icon, { name: 'settings', size: 16 }), t('settings'))),
    h('nav', { className: 'dam-tabs', role: 'tablist', 'aria-label': userScope ? t('profile') : t('projectMemory'), onKeyDown: event => { const index = tabs.indexOf(view); if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 2) % 2; setView(tabs[next]); event.currentTarget.querySelectorAll('[role=tab]')[next]?.focus(); } }, ...tabs.map(key => h('button', { key, role: 'tab', 'aria-selected': key === view, tabIndex: key === view ? 0 : -1, onClick: () => setView(key) }, t(key === 'current' ? userScope ? 'profileTitle' : 'currentMemory' : 'memoryActivity')))),
    h('div', { className: 'dam-mobile-panes', role: 'group', 'aria-label': t('pageArea') }, ...['memory', 'chat'].map(key => h('button', { className: 'dam-button', key, 'aria-pressed': mobilePane === key, onClick: () => setMobilePane(key) }, t(key === 'memory' ? 'currentMemory' : 'managerTitle')))),
    h('div', { className: 'dam-workspace-split', 'data-mobile-pane': mobilePane },
      h('main', { className: 'dam-memory-pane', 'aria-label': t('memoryDisplay') }, h(Receipt, { value: receipt, onClose: clearReceipt, t }), h(ErrorNotice, { error, retry: refresh, t }), !data && !error ? h(Loading, { t }) : null,
        data && project?.detached ? h('p', { className: 'dam-inline-status' }, t('retainedHint')) : null,
        data && !userScope && data.workspace?.enabled === false ? h('p', { className: 'dam-inline-status' }, t('memoryPausedReadable')) : null,
        data && userScope ? view === 'current' ? h('article', { className: 'dam-overview' }, h('p', { className: 'dam-eyebrow' }, t('globalScope')), h('h2', null, t('profileTitle')), h('p', { className: 'dam-hint' }, t('profileScopeHint')), data.userProfile?.content ? h('div', { className: 'dam-overview-summary' }, h(Markdown, { text: data.userProfile.content, t })) : h(Empty, { icon: 'globe', title: t('profileEmpty'), description: t('profileChatEmpty') })) : h('section', { className: 'dam-section' }, h('h2', null, t('profileChanges')), data.userProfile?.changes?.length ? data.userProfile.changes.map((item, index) => h(Change, { key: item.id || index, item, t })) : h(Empty, { icon: 'history', title: t('emptyProfileChanges') })) : data ? view === 'current' ? h(Overview, { data, selected: selection, onSelect: next => { setSelection(next); setContext(next); }, onDiscuss: discuss, act, t }) : h(Activity, { data, act, busy, t, onDiscuss: discuss }) : null),
      h(ManagerChat, { workspaceId: userScope ? null : project.id, nativeWorkspaceId: userScope ? null : project.nativeWorkspaceId, userScope, context: contextValid ? context : null, contextLabel: contextValid && context?.label || (userScope ? t('profile') : t('wholeProject')), t, onUpdated: refresh, focusRequest })));
}
function ProjectPreferences({ project, t, onCatalogRefresh, onContentReady }) {
  const { data, error, busy, act, receipt, clearReceipt } = useMemoryState(project.id);
  useEffect(() => { if (data || error) onContentReady?.(); }, [!!data, !!error, onContentReady]);
  if (!data) return h(React.Fragment, null, h(ErrorNotice, { error, t }), !error ? h(Loading, { t }) : null);
  return h('div', { className: 'dam-project-preferences' }, h(Receipt, { value: receipt, onClose: clearReceipt, t }), h(ErrorNotice, { error, t }),
    h('div', { className: 'dam-settings-control-list' },
      ...[['enabled', 'project-toggle', 'useProjectMemory', 'useProjectMemoryHint'], ['automaticDream', 'project-dream-toggle', 'automaticConsolidation', 'automaticConsolidationHint']].map(([key, action, title, hint]) => h('label', { className: 'dam-setting-row', key }, h('span', null, h('strong', null, t(title)), h('span', { className: 'dam-hint' }, t(hint))), h('input', { type: 'checkbox', role: 'switch', checked: data.workspace?.[key] !== false, disabled: busy || key === 'automaticDream' && project.detached, onChange: async e => { const result = await act(action, { enabled: e.target.checked }); if (result) onCatalogRefresh(); } }))), project.detached ? h('p', { className: 'dam-hint' }, t('retainedHint')) : null));
}
function SettingsPage({ catalog, nativeSessions, t, onBack, backLabel, onOpenProject, onCatalogRefresh, viewState = {}, onViewStateChange, onContentReady }) {
  const { data, error, busy, act, refresh, receipt, clearReceipt } = useMemoryState(null);
  const section = viewState.section || 'general', projectKey = viewState.projectKey || '';
  const setSection = value => onViewStateChange(current => ({ ...current, section: value }));
  const setProjectKey = value => onViewStateChange(current => ({ ...current, projectKey: value }));
  const all = [...(catalog.projects || []), ...(catalog.retainedProjects || [])];
  const project = all.find(p => p.key === projectKey) || all[0];
  useEffect(() => { if ((section === 'archive' || section === 'workspaces') ? !project?.id : !!data || !!error) onContentReady?.(); }, [section, project?.id, !!data, !!error, onContentReady]);
  return h(React.Fragment, null, h('header', { className: 'dam-workspace-header' }, h('div', null, h('button', { className: 'dam-button subtle dam-breadcrumb', onClick: onBack }, h(Icon, { name: 'arrow', size: 15 }), backLabel || t('backToWorkspaces')), h('h1', null, t('settings')))),
    h('div', { className: 'dam-settings-layout' }, h('nav', { className: 'dam-settings-nav', 'aria-label': t('settings') }, ...['general', 'workspaces', 'profile', 'archive'].map(key => h('button', { key, className: 'dam-button', 'aria-current': section === key ? 'page' : undefined, onClick: () => setSection(key) }, t(({ general: 'modelsAndConsolidation', workspaces: 'workspacePreferences', profile: 'profileControls', archive: 'archiveAndHistory' })[key])))),
      h('div', { className: 'dam-settings-main' }, h(Receipt, { value: receipt, onClose: clearReceipt, t }), h(ErrorNotice, { error, retry: refresh, t }), !data && !error ? h(Loading, { t }) : null,
        data && section === 'general' ? h(Settings, { data, act, busy, t }) : null,
        data && section === 'profile' ? h('section', { className: 'dam-section' }, h('h2', null, t('profileControls')), h('p', { className: 'dam-hint' }, t('profileIntro')), ...[['enabled', 'profileEnabled'], ['autoWrite', 'autoWrite']].map(([key, label]) => h('label', { className: 'dam-setting-row', key }, h('strong', null, t(label)), h('input', { type: 'checkbox', role: 'switch', checked: data.userProfile?.[key] !== false, disabled: busy, onChange: e => act('user-profile-toggle', { [key]: e.target.checked }) })))) : null,
        section === 'workspaces' ? h('section', { className: 'dam-section' }, h('h2', null, t('workspacePreferences')), all.length ? h(React.Fragment, null, h('label', { className: 'dam-field' }, h('span', null, t('chooseProject')), h('select', { value: project?.key || '', onChange: e => setProjectKey(e.target.value) }, ...all.map(p => h('option', { key: p.key, value: p.key, disabled: !p.canBrowse }, p.name)))), project?.id ? h(ProjectPreferences, { key: project.key, project, t, onCatalogRefresh, onContentReady }) : null) : h(Empty, { title: t('noWorkspaces') })) : null,
        section === 'archive' ? h('section', { className: 'dam-section' }, h('h2', null, t('archiveAndHistory')), h('p', { className: 'dam-hint' }, t('archiveHint')), h('section', { className: 'dam-settings-archive-section' }, h('h3', null, t('retainedWorkspaces')), (catalog.retainedProjects || []).length ? catalog.retainedProjects.map(p => h('button', { key: p.key, className: 'dam-archive-row', onClick: () => onOpenProject(p, { projectKey: project?.key || '' }) }, h(Icon, { name: 'folder', size: 18 }), h('span', null, h('strong', null, p.name), h('span', { className: 'dam-muted' }, t('retainedRead'))), h('span', { 'aria-hidden': true }, '›'))) : h('p', { className: 'dam-hint' }, t('noRetainedWorkspaces'))), h('section', { className: 'dam-settings-archive-section' }, h('h3', null, t('includeHistory')), h('p', { className: 'dam-hint' }, t('includeHistoryHint')), all.length ? h(React.Fragment, null, h('label', { className: 'dam-field' }, h('span', null, t('chooseProject')), h('select', { value: project?.key || '', onChange: e => setProjectKey(e.target.value) }, ...all.map(p => h('option', { key: p.key, value: p.key, disabled: !p.canBrowse }, p.name)))), project?.id ? h(HistoryPreferences, { key: project.key, project, nativeSessions, t, onContentReady, viewState: viewState.history?.[project.key] || {}, onViewStateChange: history => onViewStateChange(current => ({ ...current, history: { ...current.history, [project.key]: typeof history === 'function' ? history(current.history?.[project.key] || {}) : history } })) }) : null) : null)) : null)));
}
function HistoryPreferences({ project, nativeSessions, t, viewState, onViewStateChange, onContentReady }) {
  const { data, error, busy, act, receipt, clearReceipt } = useMemoryState(project.id);
  useEffect(() => { if (data || error) onContentReady?.(); }, [!!data, !!error, onContentReady]);
  return h(React.Fragment, null, h(Receipt, { value: receipt, onClose: clearReceipt, t }), h(ErrorNotice, { error, t }), data ? h(PastSessions, { data, nativeSessions, act, busy, t, viewState, onViewStateChange }) : !error ? h(Loading, { t }) : null);
}
/** Carry the real return destination; every content-page entry gets a new visit. */
export function navigateMemoryPage(route, action) {
  const current = { ...route, scrollTop: Math.max(0, action.scrollTop ?? route.scrollTop ?? 0) };
  const visit = (route.visit || 0) + 1;
  if (action.type === 'settings-state') {
    if (route.page !== 'settings' || action.expectedVisit != null && action.expectedVisit !== route.visit) return route;
    return { ...current, settingsState: typeof action.value === 'function' ? action.value(current.settingsState || {}) : action.value };
  }
  if (action.type === 'back') return { ...(current.returnTo || { page: 'home', scrollTop: 0 }), visit };
  if (action.type === 'home') return { page: 'home', visit, scrollTop: 0 };
  if (action.type === 'settings' && current.returnTo?.page === 'settings') return { ...current.returnTo, visit };
  if (action.type === 'settings') return { page: 'settings', visit, scrollTop: 0, settingsState: {}, returnTo: current };
  if (action.type === 'workspace') {
    const origin = current.page === 'settings' && action.settingsPatch ? { ...current, settingsState: { ...current.settingsState, ...action.settingsPatch } } : current;
    return { page: 'workspace', key: action.key, visit, scrollTop: 0, returnTo: origin };
  }
  if (action.type === 'profile') return { page: 'profile', visit, scrollTop: 0, returnTo: current };
  return route;
}
/** The DOM position is captured at the event, never inside a replayable state updater. */
export function captureMemoryNavigation(action, scrollTop) {
  const command = { ...action, scrollTop };
  return route => navigateMemoryPage(route, command);
}
function returnLabel(route, t) {
  if (route.returnTo?.page === 'settings') return t(route.returnTo.settingsState?.section === 'archive' ? 'backToArchive' : 'backToSettings');
  if (route.returnTo?.page === 'workspace') return t('backToWorkspaceMemory');
  if (route.returnTo?.page === 'profile') return t('backToProfile');
  return t('backToWorkspaces');
}
function Page({ t, useSessions, useWorkspaces }) {
  const nativeSessions = useSessions ? useSessions(s => s.byId) : {};
  const nativeSnapshot = useWorkspaces ? useWorkspaces(s => s) : null;
  const signature = JSON.stringify(nativeSnapshot?.items?.map(w => [w.workspaceId, w.title, w.path, w.sessionIds]));
  const [catalog, setCatalog] = useState({ projects: [], retainedProjects: [] }), [route, setRoute] = useState({ page: 'home', visit: 0 }), [error, setError] = useState(null), [loaded, setLoaded] = useState(false), [readyVisit, setReadyVisit] = useState(null);
  const mounted = useRef(false), request = useRef(null), pageElement = useRef(null), cancelledScrollVisit = useRef(null);
  const available = React.useSyncExternalStore(subscribeAvailability, availabilitySnapshot, availabilitySnapshot);
  const refresh = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    try { const value = await catalogRequest(controller.signal); if (mounted.current && !controller.signal.aborted) { setCatalog(value); setLoaded(true); setError(null); } }
    catch (error) { if (mounted.current && !controller.signal.aborted) { setError(error); setLoaded(true); } }
  }, []);
  useEffect(() => { mounted.current = true; void refresh(); const wake = () => { if (!document.hidden) void refresh(); }; const timer = setInterval(wake, 15000); window.addEventListener('focus', wake); return () => { mounted.current = false; request.current?.abort(); clearInterval(timer); window.removeEventListener('focus', wake); }; }, [refresh]);
  useEffect(() => { if (mounted.current) void refresh(); }, [signature, refresh]);
  const displayProject = p => ({ ...p, name: p.name === 'default-workspace' ? t('defaultWorkspace') : p.name, sessions: (p.sessions || []).map(s => ({ ...s, title: nativeSessions?.[s.id]?.displayTitle?.trim() || (s.title !== s.id ? s.title : t('untitledConversation')) })) });
  const projects = (catalog.nativeWorkspaces ? workspaceProjects(catalog.projects || [], nativeSnapshot?.items) : catalog.projects || []).map(displayProject);
  const retainedProjects = (catalog.retainedProjects || []).map(displayProject);
  const project = [...projects, ...retainedProjects].find(p => p.key === route.key);
  const navigate = action => {
    const scrollTop = pageElement.current?.scrollTop || 0;
    setRoute(captureMemoryNavigation(action, scrollTop));
  };
  const enter = (project, settingsPatch) => navigate({ type: 'workspace', key: project.key, settingsPatch });
  const back = () => navigate({ type: 'back' });
  const settings = () => navigate({ type: 'settings' });
  // A return waits for the destination's actual data render. A tall loading
  // shell is not completion: it can shrink and clamp scroll before history arrives.
  useEffect(() => { if (route.page === 'home' && loaded) setReadyVisit(route.visit); }, [route.page, route.visit, loaded]);
  useEffect(() => {
    const element = pageElement.current; if (!element || cancelledScrollVisit.current === route.visit) return;
    const top = route.scrollTop || 0, ready = readyVisit === route.visit;
    let observer, stopped = false;
    const stop = () => { if (stopped) return; stopped = true; observer?.disconnect(); element.removeEventListener('wheel', cancel); element.removeEventListener('touchstart', cancel); element.removeEventListener('keydown', cancel); };
    const cancel = () => { cancelledScrollVisit.current = route.visit; stop(); };
    const restore = () => { if (stopped) return; element.scrollTop = top; if (ready) stop(); };
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(restore); observer.observe(element.querySelector('.dam-shell') || element); }
    element.addEventListener('wheel', cancel, { passive: true }); element.addEventListener('touchstart', cancel, { passive: true }); element.addEventListener('keydown', cancel);
    restore();
    return stop;
  }, [route.visit, readyVisit === route.visit]);
  const effectiveCatalog = { ...catalog, projects, retainedProjects };
  // A removed/replaced registry row unmounts its manager; never reuse its context.
  useEffect(() => { if (loaded && route.page === 'workspace' && !project) back(); }, [loaded, route.page, route.key, !!project]);
  return h('div', { ref: pageElement, className: 'dam-root dam-page dam-workflow-page' }, h('style', null, STYLE), h('div', { className: 'dam-shell' },
    !available ? h(Empty, { title: t('unavailable') }) : route.page === 'workspace' && project ? h(WorkspacePage, { key: route.visit + ':' + project.key, project, t, onBack: back, backLabel: returnLabel(route, t), onSettings: settings, onContentReady: () => setReadyVisit(route.visit) }) : route.page === 'profile' ? h(WorkspacePage, { key: 'user:' + route.visit, userScope: true, t, onBack: back, backLabel: returnLabel(route, t), onSettings: settings, onContentReady: () => setReadyVisit(route.visit) }) : route.page === 'settings' ? h(SettingsPage, { key: 'settings:' + route.visit, catalog: effectiveCatalog, nativeSessions, t, onBack: back, backLabel: returnLabel(route, t), onOpenProject: enter, onCatalogRefresh: refresh, viewState: route.settingsState || {}, onContentReady: () => setReadyVisit(route.visit), onViewStateChange: value => navigate({ type: 'settings-state', value, expectedVisit: route.visit }) }) : h(React.Fragment, null,
      h('header', { className: 'dam-page-header' }, h('div', { className: 'dam-heading' }, h('div', { className: 'dam-title' }, h(Icon, { size: 25 }), h('h1', null, t('pageTitle'))), h('p', { className: 'dam-subtitle' }, t('homeSubtitle'))), h('button', { className: 'dam-button', onClick: settings }, h(Icon, { name: 'settings', size: 16 }), t('settings'))),
      h(ErrorNotice, { error, retry: refresh, t }), !loaded ? h(Loading, { t }) : h('section', { className: 'dam-home-workspaces', 'aria-label': t('workspaces') }, h('div', { className: 'dam-section-head' }, h('h2', null, t('workspaces')), h('span', { className: 'dam-muted' }, t('projectCount', { count: projects.length }))), projects.length ? h('div', { className: 'dam-workspace-grid' }, ...projects.map(p => h('button', { className: 'dam-workspace-card', key: p.key, disabled: !p.canBrowse, onClick: () => enter(p), 'aria-label': t('openWorkspaceMemory', { name: p.name }) }, h('span', { className: 'dam-workspace-card-icon' }, h(Icon, { name: 'folder', size: 23 })), h('h3', null, p.name), h('p', null, previewText(p.summary) || (p.enabled === false ? t('memoryPausedReadable') : t('workspaceCardHint'))), h('span', { className: 'dam-workspace-card-open' }, t('openMemory'), ' →')))) : h(Empty, { title: t('noWorkspaces'), description: t('noWorkspacesHint') })),
      h('button', { className: 'dam-global-card', onClick: () => navigate({ type: 'profile' }) }, h('span', { className: 'dam-workspace-card-icon' }, h(Icon, { name: 'globe', size: 23 })), h('span', null, h('strong', null, t('profileTitle')), h('span', { className: 'dam-muted' }, t('profileSubtitle'))), h('span', { className: 'dam-global-open', 'aria-hidden': true }, '→')))));
}

export function migrateLegacyTabs(sidebar, schedule = requestAnimationFrame, cancel = cancelAnimationFrame) {
  let frame = null, stopped = false;
  const wake = () => {
    if (frame !== null) cancel(frame);
    const sessionId = sidebar.mounted.getSnapshot();
    if (!sessionId || stopped) return;
    frame = schedule(() => { frame = schedule(() => {
      frame = null;
      if (stopped || sidebar.mounted.getSnapshot() !== sessionId) return;
      for (const tab of sidebar.tabsIn(sessionId)) if (tab.kind === NS) sidebar.close(tab.id);
    }); });
  };
  const stops = [sidebar.mounted.subscribe(wake), sidebar.openTabs.subscribe(wake)];
  wake();
  return () => { stopped = true; if (frame !== null) cancel(frame); stops.forEach(stop => stop()); };
}
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => createAvailabilityMonitor().dispose, 'automemory: availability');
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'automemory: copy');
  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: NS, locale: NS, inject: () => ({ openSession: id => ctx.uiWorkspace.openSession(id) }) }, Page)), 'automemory: page');
  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => {
    let release;
    const sync = () => {
      if (serviceAvailable && !release) release = ctx.slots.register({ name: 'sidebar.panellist', id: NS, order: 15, locale: NS, label: () => t('tab') }, Icon);
      else if (!serviceAvailable && release) { release(); release = null; }
    };
    sync(); const unsubscribe = subscribeAvailability(sync);
    return () => { unsubscribe(); release?.(); };
  }), 'automemory: navigation');
  // Retire only this plugin's legacy tabs as their owning session is mounted.
  ctx.inject?.(['sidebarRight'], c => { c.effect(() => migrateLegacyTabs(c.sidebarRight), 'automemory: legacy tabs'); });
}
export { inject, apply, Page, WorkspacePage as Panel };
