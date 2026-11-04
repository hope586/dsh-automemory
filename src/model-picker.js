/** The same host catalog used by the conversation model selector. No Session is created or changed. */
export function createNativeModelCatalog(read) {
  let state = { status: 'idle', value: null, error: null }, pending, generation = 0, disposed = false;
  const listeners = new Set();
  const publish = next => { state = next; for (const listener of listeners) listener(); };
  const load = () => {
    if (disposed) return Promise.resolve(null);
    if (pending) return pending;
    if (state.status === 'ready') return Promise.resolve(state.value);
    const epoch = generation;
    publish({ ...state, status: 'loading', error: null });
    const operation = Promise.resolve().then(read).then(response => {
      if (response?.ok !== true) throw new Error(response?.error?.message || 'Model catalog unavailable');
      const value = response.value;
      if (!Array.isArray(value?.groups) || !Array.isArray(value?.failures)) throw new Error('Invalid model catalog');
      if (!disposed && epoch === generation) publish({ status: 'ready', value, error: null });
      return value;
    }).catch(error => {
      if (!disposed && epoch === generation) publish({ ...state, status: 'error', error });
      throw error;
    }).finally(() => { if (pending === operation) pending = null; });
    pending = operation;
    return operation;
  };
  return {
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    load,
    refresh(clear = false) {
      if (disposed) return Promise.resolve(null);
      generation++; pending = null;
      publish({ status: 'idle', value: clear ? null : state.value, error: null });
      return load();
    },
    dispose() { disposed = true; generation++; pending = null; listeners.clear(); },
  };
}

export const modelRouteKey = route => route ? JSON.stringify([route.provider, route.model]) : 'follow-session';
export function catalogChoices(catalog) {
  return (catalog?.groups || []).flatMap(group => group.models.map(model => ({
    key: modelRouteKey({ provider: group.id, model: model.id }),
    provider: group.id, providerName: group.name, model: model.id, name: model.name, reasoning: model.reasoning,
  })));
}
export function chooseCatalogModel(catalog, key, current, allowFollow = false) {
  if (allowFollow && key === 'follow-session') return null;
  const choice = catalogChoices(catalog).find(item => item.key === key);
  if (!choice) throw new Error('Model is no longer in the catalog');
  if (modelRouteKey(current) === key) return { ...current };
  return { provider: choice.provider, model: choice.model,
    ...(choice.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: choice.reasoning.defaultEffort }) };
}
export function chooseCatalogEffort(catalog, current, effort) {
  const model = catalogChoices(catalog).find(item => item.key === modelRouteKey(current));
  if (!model?.reasoning || effort !== undefined && !model.reasoning.efforts.some(item => item.id === effort)) throw new Error('Unsupported reasoning effort');
  const { reasoningEffort: _old, ...route } = current;
  return { ...route, ...(effort === undefined ? {} : { reasoningEffort: effort }) };
}

/** Native Menu supplies the same theme, portal placement and keyboard behavior as the host. */
export function ModelPicker({ role, value, catalog, onChange, disabled, t }) {
  const h = React.createElement;
  const [open, setOpen] = React.useState(null);
  const selectedKey = modelRouteKey(value), choices = catalogChoices(catalog);
  const selected = choices.find(item => item.key === selectedKey);
  const follow = role === 'g2' && !value;
  const items = role === 'g2' ? [{ id: 'follow-session', label: t('followSession') }, { type: 'separator', id: 'follow-divider' }] : [];
  for (const group of catalog?.groups || []) {
    if (!group.models.length) continue;
    items.push({ type: 'label', id: 'provider:' + group.id, text: group.name });
    for (const model of group.models) items.push({ id: modelRouteKey({ provider: group.id, model: model.id }), label: model.name });
  }
  if (!choices.length) items.push({ id: 'empty', label: t('noModels'), disabled: true });
  const reasoning = selected?.reasoning;
  const effort = value?.reasoningEffort ?? reasoning?.defaultEffort;
  const effortItems = reasoning ? [
    ...(reasoning.defaultEffort === undefined ? [{ id: 'provider-default', label: t('providerDefault') }] : []),
    ...reasoning.efforts.map(item => ({ id: JSON.stringify(item.id), label: item.name })),
  ] : [];
  const trigger = (kind, label, caption) => h('button', {
    type: 'button', className: 'dam-button dam-model-trigger', disabled,
    'aria-label': t(role) + ' · ' + t(kind === 'model' ? 'model' : 'reasoningEffort'),
    'aria-haspopup': 'menu', 'aria-expanded': open === kind,
    onClick: () => setOpen(old => old === kind ? null : kind),
  }, h('span', null, h('span', { className: 'dam-model-name' }, label), caption ? h('span', { className: 'dam-muted' }, caption) : null),
  h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4', stroke: 'currentColor', strokeWidth: 1.5 })));
  return h('div', { className: 'dam-model-picker' },
    h(NativeMenu, { open: open === 'model' && !disabled, portal: true, autoFocus: true, className: 'dam-model-menu',
      anchor: trigger('model', follow ? t('followSession') : selected?.name || value?.model || t('selectModel'), follow ? null : selected?.providerName || value?.provider),
      items, selectedId: selectedKey, onClose: () => setOpen(null),
      onSelect: key => { if (disabled) return; onChange(chooseCatalogModel(catalog, key, value, role === 'g2')); setOpen(null); },
    }),
    catalog && value && !selected ? h('p', { className: 'dam-hint' }, t('savedModelOutsideCatalog')) : null,
    reasoning && effortItems.length ? h('div', { className: 'dam-model-effort' }, h('span', { className: 'dam-hint' }, t('reasoningEffort')),
      h(NativeMenu, { open: open === 'effort' && !disabled, portal: true, autoFocus: true, className: 'dam-model-menu',
        anchor: trigger('effort', reasoning.efforts.find(item => item.id === effort)?.name || effort || t('providerDefault')),
        items: effortItems, selectedId: effort === undefined ? 'provider-default' : JSON.stringify(effort), onClose: () => setOpen(null),
        onSelect: key => { if (disabled) return; onChange(chooseCatalogEffort(catalog, value, key === 'provider-default' ? undefined : JSON.parse(key))); setOpen(null); },
      })) : null);
}
