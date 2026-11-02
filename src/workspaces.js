import path from 'node:path';
import { workspaceIdentity } from './identity.js';

// Native workspace IDs identify sidebar registrations. Memory IDs identify
// project storage (including shared Git worktrees); keep these two identities.
export function nativeWorkspacesFor(controller) {
  const registry = controller.ctx.get('workspaceRegistry');
  if (!registry) return null; // Headless hosts may have no workspace service.
  return registry.list().map(workspace => {
    const saved = controller.store.nativeWorkspace(workspace.id);
    let identity;
    try { identity = workspaceIdentity(workspace.path); }
    catch {
      if (saved?.path === workspace.path) identity = { id: saved.memory_id, root: saved.root };
      else {
        const stored = controller.store.listWorkspaces().find(w => w.root === workspace.path);
        if (stored) identity = stored;
      }
    }
    if (identity) controller.store.rememberNativeWorkspace({ nativeId: workspace.id, memoryId: identity.id, root: identity.root, path: workspace.path, title: workspace.title });
    return { key: workspace.id, nativeWorkspaceId: workspace.id, id: identity?.id || null,
      name: workspace.title || path.basename(workspace.path), path: workspace.path,
      root: identity?.root || workspace.path, canBrowse: !!identity, sessionIds: [...workspace.sessionIds] };
  });
}
