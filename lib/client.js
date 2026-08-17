window.__ModuleLoader__.load({
	id: "@jackyoung022/dsh-session-canvas",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let React = require("react");

		// ------------------------------------------------------------------ api
		const API = {
			context: '/api/dsh-session-canvas/context',
			workspaces: '/api/dsh-session-canvas/workspaces',
			sessions: '/api/dsh-session-canvas/sessions',
			read: '/api/dsh-session-canvas/read',
			chat: '/api/dsh-session-canvas/chat',
			inject: '/api/dsh-session-canvas/inject',
			create: '/api/dsh-session-canvas/create',
			newSession: '/api/dsh-session-canvas/new-session',
			commands: '/api/dsh-session-canvas/commands',
			command: '/api/dsh-session-canvas/command',
			skill: '/api/dsh-session-canvas/skill',
		};
		async function api(path, opts) {
			const res = await fetch(path, opts);
			let data = {};
			try { data = await res.json(); } catch (e) { /* ignore */ }
			if (!res.ok) {
				const err = new Error((data && data.error) || ('HTTP ' + res.status));
				if (data && data.code) err.code = data.code;
				throw err;
			}
			return data;
		}
		const jsonPost = (body) => ({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

		// ------------------------------------------------------------------ css
		const CSS = `
.dsc-canvas { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: var(--dsw-alias-bg-base, #18181b); color: var(--dsw-alias-label-primary, #e4e4e7); font-size: 13px; pointer-events: auto; }
.dsc-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, #333); background: var(--dsw-alias-bg-layer-1, #202024); flex-shrink: 0; }
.dsc-toolbar h1 { font-size: 14px; margin: 0; font-weight: 600; white-space: nowrap; }
.dsc-toolbar .spacer { flex: 1; }
.dsc-ws-select { background: var(--dsw-alias-bg-layer-2, #2a2a2e); color: var(--dsw-alias-label-primary, #e4e4e7); border: 1px solid var(--dsw-alias-border-l1, #333); border-radius: 6px; padding: 4px 8px; font-size: 12px; max-width: 240px; }
.dsc-btn { background: var(--dsw-alias-bg-layer-2, #2a2a2e); color: var(--dsw-alias-label-primary, #e4e4e7); border: 1px solid var(--dsw-alias-border-l1, #333); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; white-space: nowrap; }
.dsc-btn:hover { border-color: #4f8cff; }
.dsc-btn.primary { background: #4f8cff; color: #fff; border-color: transparent; }
.dsc-btn.primary:disabled { background: #4f8cff; color: #fff; opacity: 0.45; cursor: default; }
.dsc-btn.active { border-color: #4f8cff; color: #4f8cff; }
.dsc-btn.danger { color: var(--dsw-alias-state-error-primary, #ef4444); }
.dsc-canvas-body { flex: 1; position: relative; overflow: auto; }
.dsc-canvas-bg { position: absolute; inset: 0; background-image: radial-gradient(circle, var(--dsw-alias-border-l1, #333) 1px, transparent 1px); background-size: 24px 24px; }
.dsc-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.dsc-edge { stroke: var(--dsw-alias-label-secondary, #888); stroke-width: 1.5; }
.dsc-edge-hit { stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; }
.dsc-edge-del { pointer-events: all; cursor: pointer; }
.dsc-edge-preview { stroke: #4f8cff; stroke-width: 2; stroke-dasharray: 6 4; }
.dsc-preview-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 6; }
.dsc-node { position: absolute; z-index: 1; min-width: 200px; min-height: 120px; display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1, #202024); border: 1px solid var(--dsw-alias-border-l1, #333); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: grab; user-select: none; overflow: hidden; }
.dsc-node.selected { border-color: #4f8cff; box-shadow: 0 0 0 2px rgba(79,140,255,.3); }
.dsc-node.drop-target { border-color: #4f8cff; box-shadow: 0 0 0 3px rgba(79,140,255,.45); }
.dsc-node-del { position: absolute; top: -8px; right: -8px; width: 18px; height: 18px; border-radius: 50%; background: var(--dsw-alias-bg-overlay, #26262a); border: 1px solid var(--dsw-alias-border-l2, #444); color: var(--dsw-alias-label-secondary, #888); font-size: 11px; line-height: 15px; text-align: center; cursor: pointer; opacity: 0; transition: opacity .15s; z-index: 4; }
.dsc-node:hover .dsc-node-del { opacity: 1; }
.dsc-node-del:hover { color: var(--dsw-alias-state-error-primary, #ef4444); border-color: var(--dsw-alias-state-error-primary, #ef4444); }
.dsc-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; z-index: 4; }
.dsc-resize-handle::after { content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px; border-right: 2px solid var(--dsw-alias-label-secondary, #888); border-bottom: 2px solid var(--dsw-alias-label-secondary, #888); }
.dsc-port { position: absolute; width: 13px; height: 13px; border-radius: 50%; background: #4f8cff; border: 2px solid var(--dsw-alias-bg-layer-1, #202024); opacity: 0; transition: opacity .15s, transform .15s; cursor: crosshair; z-index: 3; }
.dsc-node:hover .dsc-port { opacity: 1; }
.dsc-port:hover { transform: scale(1.25); }
.dsc-port.top { top: -7px; left: 50%; margin-left: -7px; }
.dsc-port.bottom { bottom: -7px; left: 50%; margin-left: -7px; }
.dsc-port.left { left: -7px; top: 50%; margin-top: -7px; }
.dsc-port.right { right: -7px; top: 50%; margin-top: -7px; }
.dsc-node-head { flex-shrink: 0; padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, #333); }
.dsc-node-title { font-weight: 600; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsc-node-sub { color: var(--dsw-alias-label-secondary, #888); font-size: 10.5px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsc-node-body { flex: 1; min-height: 0; overflow: auto; padding: 5px 10px; font-size: 11.5px; color: var(--dsw-alias-label-secondary, #aaa); white-space: pre-wrap; word-break: break-word; }
.dsc-node-empty { color: var(--dsw-alias-label-secondary, #888); font-style: italic; }
.dsc-node-footer { flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding: 2px 8px; border-top: 1px solid var(--dsw-alias-border-l1, #333); font-size: 11px; }
.dsc-node-footer .spacer { flex: 1; }
.dsc-node-footer button { background: none; border: none; color: var(--dsw-alias-label-secondary, #888); cursor: pointer; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.dsc-node-footer button:hover { color: #4f8cff; background: var(--dsw-alias-bg-layer-2, #2a2a2e); }
.dsc-node-footer button.danger { color: var(--dsw-alias-state-error-primary, #ef4444); }
.dsc-node-footer button:disabled { opacity: .5; cursor: default; }
.dsc-chat { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.dsc-chat-list { flex: 1; overflow: auto; padding: 2px 4px; display: flex; flex-direction: column; gap: 3px; }
.dsc-chat-row { font-size: 11px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
.dsc-chat-row .who { font-weight: 600; margin-right: 4px; }
.dsc-chat-row.user .who { color: #4f8cff; }
.dsc-chat-row.assistant .who { color: #5eead4; }
.dsc-thinking { color: #5eead4; font-style: italic; animation: dsc-blink 1s ease-in-out infinite; }
@keyframes dsc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.dsc-chat-row.tool .who { color: var(--dsw-alias-state-warn-primary, #f5a524); }
.dsc-chat-input-row { position: relative; display: flex; gap: 4px; padding: 3px 6px; border-top: 1px solid var(--dsw-alias-border-l1, #333); }
.dsc-slash-menu { position: absolute; bottom: 100%; left: 4px; right: 4px; max-height: 150px; overflow: auto; background: var(--dsw-alias-bg-overlay, #26262a); border: 1px solid var(--dsw-alias-border-l2, #444); border-radius: 6px; z-index: 20; box-shadow: 0 -4px 12px rgba(0,0,0,.3); }
.dsc-slash-item { display: flex; align-items: baseline; gap: 6px; padding: 4px 8px; cursor: pointer; font-size: 11px; }
.dsc-slash-item:hover, .dsc-slash-item.active { background: var(--dsw-alias-bg-layer-2, #2a2a2e); }
.dsc-slash-item.active { box-shadow: inset 2px 0 #4f8cff; }
.dsc-slash-item .n { color: #4f8cff; font-weight: 600; white-space: nowrap; }
.dsc-slash-item.skill .n { color: #5eead4; }
.dsc-slash-item .d { color: var(--dsw-alias-label-secondary, #888); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-chat-input-row input { flex: 1; min-width: 0; background: var(--dsw-alias-bg-layer-2, #2a2a2e); color: var(--dsw-alias-label-primary, #e4e4e7); border: 1px solid var(--dsw-alias-border-l1, #333); border-radius: 5px; padding: 3px 6px; font-size: 11px; }
.dsc-chat-input-row button { background: #4f8cff; color: #fff; border: none; border-radius: 5px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
.dsc-chat-input-row button:disabled { opacity: .5; }
.dsc-library { position: absolute; left: 12px; top: 12px; z-index: 5; width: 240px; max-height: 58%; display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1, #202024); border: 1px solid var(--dsw-alias-border-l1, #333); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.3); }
.dsc-library-head { padding: 6px 10px; font-weight: 600; border-bottom: 1px solid var(--dsw-alias-border-l1, #333); font-size: 12px; display: flex; align-items: center; gap: 6px; }
.dsc-library-head .spacer { flex: 1; }
.dsc-library-list { overflow: auto; padding: 4px; }
.dsc-library-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 5px; cursor: pointer; font-size: 11.5px; }
.dsc-library-item:hover { background: var(--dsw-alias-bg-layer-2, #2a2a2e); }
.dsc-library-item .t { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsc-library-item .add { color: #4f8cff; font-weight: 700; }
.dsc-library-item .added { color: var(--dsw-alias-state-success-primary, #34d399); }
.dsc-detail { position: absolute; right: 12px; top: 12px; z-index: 5; width: 340px; max-height: 70%; display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1, #202024); border: 1px solid var(--dsw-alias-border-l1, #333); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.3); }
.dsc-detail-head { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, #333); font-weight: 600; font-size: 12px; }
.dsc-detail-body { overflow: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.dsc-msg { font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.dsc-msg .role { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-bottom: 2px; font-weight: 600; }
.dsc-msg.user .role { background: rgba(79,140,255,.18); color: #4f8cff; }
.dsc-msg.assistant .role { background: rgba(94,234,212,.14); color: #5eead4; }
.dsc-msg.tool .role { background: rgba(245,165,36,.15); color: var(--dsw-alias-state-warn-primary, #f5a524); }
.dsc-modal-mask { position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }
.dsc-modal { width: 460px; background: var(--dsw-alias-bg-overlay, #26262a); border: 1px solid var(--dsw-alias-border-l2, #444); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.dsc-modal h2 { margin: 0; font-size: 13.5px; }
.dsc-modal input, .dsc-modal textarea { background: var(--dsw-alias-bg-layer-2, #2a2a2e); color: var(--dsw-alias-label-primary, #e4e4e7); border: 1px solid var(--dsw-alias-border-l1, #333); border-radius: 6px; padding: 6px 8px; font-size: 12px; width: 100%; box-sizing: border-box; font-family: inherit; }
.dsc-modal textarea { min-height: 84px; resize: vertical; }
.dsc-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dsc-statusbar { padding: 4px 12px; border-top: 1px solid var(--dsw-alias-border-l1, #333); font-size: 11px; color: var(--dsw-alias-label-secondary, #888); background: var(--dsw-alias-bg-layer-1, #202024); flex-shrink: 0; display: flex; gap: 14px; align-items: center; }
.dsc-sidebar-entry { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; background: none; border: none; color: var(--dsw-alias-label-primary, #e4e4e7); cursor: pointer; border-radius: 6px; font-size: 12.5px; }
.dsc-sidebar-entry:hover { background: var(--dsw-alias-bg-layer-2, #2a2a2e); }
.dsc-error { color: var(--dsw-alias-state-error-primary, #ef4444); font-size: 11.5px; }
.dsc-empty { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); color: var(--dsw-alias-label-secondary, #888); font-size: 12.5px; text-align: center; line-height: 1.9; white-space: pre-line; }
`;

		function injectStyle() {
			const tag = document.createElement('style');
			tag.dataset.dshSessionCanvas = '';
			tag.textContent = CSS;
			document.head.appendChild(tag);
			return () => { if (tag.parentNode) tag.parentNode.removeChild(tag); };
		}

		// ------------------------------------------------------------------ plugin
		const inject = ['slots'];

		function apply(ctx) {
			const slots = ctx.slots;
			if (slots === undefined) return;
			const sessionsSvc = ctx.get('sessions');
			const workspacesSvc = ctx.get('workspaces');
			const timer = ctx.get('timer');
			const removeStyle = injectStyle();
			ctx.effect(() => removeStyle, 'dsh-session-canvas: styles');

			let open = false;
			const listeners = new Set();
			function setOpen(v) {
				if (open === v) return;
				open = v;
				listeners.forEach((fn) => fn());
			}

			function lsGet(key) {
				try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch (e) { return null; }
			}
			function lsSet(key, value) {
				try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch (e) { /* ignore */ }
			}
			const persist = timer
				? timer.debounce((key, layout) => { lsSet(key, JSON.stringify(layout)); }, 500)
				: (key, layout) => { lsSet(key, JSON.stringify(layout)); };
			ctx.effect(() => () => { if (persist && persist.dispose) persist.dispose(); });

			// ---------- sidebar entry ----------
			slots.inject('sidebar.footer.action', () => slots.register(
				{ name: 'sidebar.footer.action', id: 'session-canvas', order: 100, label: '会话画布' },
				(props) => React.createElement('button', {
					className: 'dsc-sidebar-entry',
					onClick: () => setOpen(true),
					title: '会话画布（多会话汇总对话）',
				}, (props && props.wide) ? '会话画布' : '◫'),
			));

			// ---------- overlay ----------
			slots.inject('shell.overlay', () => slots.register(
				{ name: 'shell.overlay', id: 'session-canvas' },
				() => React.createElement(CanvasGate, null),
			));

			function CanvasGate() {
				const [isOpen, setOpenState] = React.useState(open);
				React.useEffect(() => {
					const fn = () => setOpenState(open);
					listeners.add(fn);
					return () => listeners.delete(fn);
				}, []);
				if (!isOpen) return null;
				return React.createElement(SessionCanvas, { setOpen, sessionsSvc, workspacesSvc, persist });
			}

			// ---------- main canvas ----------
			function SessionCanvas({ setOpen, sessionsSvc, workspacesSvc, persist }) {
				const canvasBodyRef = React.useRef(null);
				const [wsPath, setWsPath] = React.useState('');
				const [workspaces, setWorkspaces] = React.useState([]);
				const [sessions, setSessions] = React.useState(null);
				const [loading, setLoading] = React.useState(false);
				const [loadError, setLoadError] = React.useState('');
				const [layout, setLayout] = React.useState({ nodes: {}, edges: [] });
				const [selected, setSelected] = React.useState({});
				const [detailId, setDetailId] = React.useState(null);
				const [previews, setPreviews] = React.useState({});
				const [chatOpen, setChatOpen] = React.useState({});
				const [chatBusy, setChatBusy] = React.useState({});
				const [sessionDeleting, setSessionDeleting] = React.useState({});
				const [chatDrafts, setChatDrafts] = React.useState({});
				const [dragEdge, setDragEdge] = React.useState(null);
				const [dropTarget, setDropTarget] = React.useState(null);
				const [modal, setModal] = React.useState(false);
				const [status, setStatus] = React.useState('');
				const [slashCandidates, setSlashCandidates] = React.useState(null);
				const ensureSlashCandidates = () => {
					if (slashCandidates) return;
					api(API.commands).then((res) => {
						setSlashCandidates({
							commands: (res && Array.isArray(res.commands)) ? res.commands : [],
							skills: (res && Array.isArray(res.skills)) ? res.skills : [],
						});
					}).catch(() => { /* ignore */ });
				};

				const layoutKey = 'dsh.session-canvas.v1.' + (wsPath || 'default');
				const archivedSessionIds = () => {
					try {
						const store = workspacesSvc && workspacesSvc.list;
						const snapshot = store && typeof store.getSnapshot === 'function' ? store.getSnapshot() : null;
						return new Set(snapshot && Array.isArray(snapshot.archivedSessionIds) ? snapshot.archivedSessionIds : []);
					} catch (e) {
						return new Set();
					}
				};
				React.useEffect(() => {
					const store = workspacesSvc && workspacesSvc.list;
					if (!store || typeof store.subscribe !== 'function') return undefined;
					const syncArchived = () => {
						const archived = archivedSessionIds();
						if (!archived.size) return;
						setSessions((prev) => Array.isArray(prev) ? prev.filter((session) => !archived.has(session.id)) : prev);
						setLayout((prev) => {
							const nodes = Object.assign({}, prev.nodes);
							let changed = false;
							for (const id of archived) {
								if (nodes[id]) { delete nodes[id]; changed = true; }
							}
							const edges = prev.edges.filter((edge) => !archived.has(edge.from) && !archived.has(edge.to));
							return changed || edges.length !== prev.edges.length ? { nodes: nodes, edges: edges } : prev;
						});
					};
					syncArchived();
					return store.subscribe(syncArchived);
				}, [workspacesSvc]);

				// load workspace context, workspaces, sessions, layout
				React.useEffect(() => {
					let alive = true;
					async function init() {
						let cwd = '';
						try {
							const res = await api(API.context);
							if (res && typeof res.cwd === 'string') cwd = res.cwd;
						} catch (e) { /* ignore */ }
						let wsList = [];
						try {
							const res = await api(API.workspaces);
							if (res && Array.isArray(res.workspaces)) wsList = res.workspaces;
						} catch (e) { /* ignore */ }
						if (!alive) return;
						setWorkspaces(wsList);
						setWsPath(cwd);
						loadWorkspace(cwd, wsList, alive);
					}
					init();
					return () => { alive = false; };
				}, []);

				function loadWorkspace(path, wsList, alive) {
					const useAlive = alive !== undefined ? alive : true;
					const archived = archivedSessionIds();
					// load layout for this workspace
					const raw = lsGet('dsh.session-canvas.v1.' + (path || 'default'));
					let l = { nodes: {}, edges: [] };
					if (raw) {
						try {
							const parsed = JSON.parse(raw);
							if (parsed && typeof parsed === 'object' && parsed.nodes && parsed.edges) l = { nodes: parsed.nodes, edges: parsed.edges };
						} catch (e) { /* ignore */ }
					}
					if (archived.size) {
						const nodes = Object.assign({}, l.nodes);
						for (const id of archived) delete nodes[id];
						l = { nodes: nodes, edges: l.edges.filter((e) => !archived.has(e.from) && !archived.has(e.to)) };
					}
					if (useAlive) setLayout(l);
					// load sessions filtered by cwd
					setLoading(true);
					api(API.sessions + (path ? '?cwd=' + encodeURIComponent(path) : ''))
						.then((res) => {
							if (!useAlive) return;
							const items = Array.isArray(res && res.sessions) ? res.sessions : [];
							setSessions(items.filter((session) => !archived.has(session.id)));
							setLoadError('');
						})
						.catch((e) => {
							if (useAlive) setLoadError('加载会话列表失败：' + String((e && e.message) || e));
						})
						.finally(() => { if (useAlive) setLoading(false); });
				}

				const switchWorkspace = (path) => {
					setWsPath(path);
					setSelected({});
					setDetailId(null);
					loadWorkspace(path);
				};

				React.useEffect(() => {
					persist(layoutKey, layout);
				}, [layout, layoutKey]);

				const onKeyDown = (e) => {
					if (e.key === 'Escape') {
						if (modal) { setModal(false); return; }
						if (dragEdge) { setDragEdge(null); setDropTarget(null); return; }
						if (detailId) { setDetailId(null); return; }
						setSelected({});
					}
				};

				const nodeIds = Object.keys(layout.nodes);
				const selectedIds = Object.keys(selected);
				const sessionById = {};
				if (Array.isArray(sessions)) {
					for (const s of sessions) sessionById[s.id] = s;
				}

				// ---------- node mutations ----------
				const addNode = (id, placement) => {
					const body = canvasBodyRef.current;
					const centered = placement === 'center' && body ? {
						x: Math.max(0, Math.round(body.scrollLeft + (body.clientWidth - 250) / 2)),
						y: Math.max(0, Math.round(body.scrollTop + (body.clientHeight - 170) / 2)),
					} : null;
					setLayout((prev) => {
						if (prev.nodes[id]) return prev;
						const count = Object.keys(prev.nodes).length;
						const x = centered ? centered.x : 60 + (count % 5) * 40;
						const y = centered ? centered.y : 70 + Math.floor(count / 5) * 30;
						return { nodes: Object.assign({}, prev.nodes, { [id]: { x: x, y: y, w: 250, h: 170 } }), edges: prev.edges };
					});
					setStatus('已添加会话到画布');
				};
				const moveNode = (id, x, y) => {
					setLayout((prev) => {
						const n = prev.nodes[id];
						if (!n) return prev;
						return { nodes: Object.assign({}, prev.nodes, { [id]: { x: Math.max(0, x), y: Math.max(0, y), w: n.w, h: n.h } }), edges: prev.edges };
					});
				};
				// connect from -> to and auto-inject source content into target
				const addEdge = (from, to) => {
					if (from === to) { setStatus('不能连接自身'); return; }
					setLayout((prev) => {
						const dup = prev.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from));
						if (dup) return prev;
						return { nodes: prev.nodes, edges: prev.edges.concat([{ from: from, to: to }]) };
					});
					setStatus('已连接 ' + from + ' → ' + to + '，正在注入内容…');
					api(API.inject, jsonPost({ targetId: to, sourceIds: [from] }))
						.then(() => setStatus('已连接并注入 ' + from + ' 的内容到 ' + to))
						.catch((e) => setStatus('已连接（注入失败：' + ((e && e.message) || e) + '）'));
				};
				const removeEdge = (index) => {
					setLayout((prev) => ({
						nodes: prev.nodes,
						edges: prev.edges.filter((_, i) => i !== index),
					}));
				};
				const clearCanvas = () => {
					setLayout({ nodes: {}, edges: [] });
					setSelected({});
					setStatus('画布已清空');
				};

				// ---------- selection ----------
				const onNodeClick = (id, e) => {
					if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
						setSelected((prev) => {
							const n = Object.assign({}, prev);
							if (n[id]) delete n[id];
							else n[id] = true;
							return n;
						});
					} else {
						setSelected({ [id]: true });
					}
				};
				const onNodeOpen = (id) => {
					ensurePreview(id);
					setDetailId(id);
				};

				// ---------- previews ----------
				const onPreview = (id) => ensurePreview(id);
				const ensurePreview = (id, force) => {
					setPreviews((prev) => {
						if (!force && prev[id]) return prev;
						const next = Object.assign({}, prev, { [id]: { loading: true, messages: null, title: '', error: '' } });
						api(API.read + '?id=' + encodeURIComponent(id)).then((res) => {
							setPreviews((p) => Object.assign({}, p, { [id]: {
								loading: false,
								messages: (res && res.messages) || [],
								title: (res && res.title) || '',
								error: (res && res.error) || '',
							} }));
						}).catch((err) => {
							setPreviews((p) => Object.assign({}, p, { [id]: { loading: false, messages: null, title: '', error: String(err) } }));
						});
						return next;
					});
				};

				// ---------- chat in card ----------
				const toggleChat = (id) => {
					setChatOpen((prev) => {
						const n = Object.assign({}, prev);
						n[id] = !n[id];
						return n;
					});
					ensurePreview(id, true);
				};
				const onChatDraft = (id, text) => {
					setChatDrafts((prev) => Object.assign({}, prev, { [id]: text }));
				};

				// Load a skill and immediately start a model turn. Merely injecting
				// instructions changes context but does not wake the agent loop.
				const onSkillInject = async (id, name, text) => {
					if (chatBusy[id]) return;
					setChatBusy((prev) => Object.assign({}, prev, { [id]: true }));
					setChatDrafts((prev) => Object.assign({}, prev, { [id]: '' }));
					setStatus('正在加载并执行 skill「' + name + '」…');
					setPreviews((prev) => {
						const cur = prev[id];
						const msgs = (cur && cur.messages) || [];
						return Object.assign({}, prev, { [id]: Object.assign({}, cur || { title: '', error: '' }, { loading: false, messages: msgs.concat([{ role: 'assistant', text: '正在加载并执行 skill「' + name + '」…', time: Date.now(), src: 'assistant' }]) }) });
					});
					try {
						const res = await api(API.skill, jsonPost({ sessionId: id, name: name, text: (text || '').trim() }));
						const ok = !!(res && res.ok);
						if (!ok) setStatus('skill 执行失败：' + ((res && res.error) || '未知错误'));
						else if (res.agentError) setStatus('skill 执行出错：' + res.agentError);
						else if (res.reply) setStatus('skill「' + name + '」已执行并收到回复');
						else setStatus('skill 已提交，但模型暂未返回内容');
					} catch (e) {
						setStatus('skill 执行失败：' + String((e && e.message) || e));
					} finally {
						setChatBusy((prev) => Object.assign({}, prev, { [id]: false }));
						ensurePreview(id, true);
					}
				};

				const onSend = async (id) => {
					const text = (chatDrafts[id] || '').trim();
					if (!text || chatBusy[id]) return;
					// A completed `/skill-name task` is a skill invocation, not a
					// regular slash command. This also makes the send button behave
					// the same as Enter after keyboard completion.
					if (text.startsWith('/') && slashCandidates) {
						const slashBody = text.slice(1).trimStart();
						const splitAt = slashBody.search(/\s/);
						const slashName = (splitAt >= 0 ? slashBody.slice(0, splitAt) : slashBody).toLowerCase();
						const skill = (slashCandidates.skills || []).find((item) => String(item.name || '').toLowerCase() === slashName);
						if (skill) {
							const taskText = splitAt >= 0 ? slashBody.slice(splitAt).trim() : '';
							return onSkillInject(id, skill.name, taskText);
						}
					}
					setChatBusy((prev) => Object.assign({}, prev, { [id]: true }));
					setStatus('对话中…');
					// optimistic: show the user's message immediately
					setPreviews((prev) => {
						const cur = prev[id];
						const msgs = (cur && cur.messages) || [];
						return Object.assign({}, prev, { [id]: Object.assign({}, cur || { title: '', error: '' }, { loading: false, messages: msgs.concat([{ role: 'user', text: text, time: Date.now(), src: 'user' }]) }) });
					});
					setChatDrafts((prev) => Object.assign({}, prev, { [id]: '' }));
					// "/" input executes a slash command directly (tool/handler),
					// otherwise it is a normal chat message to the model.
					if (text.startsWith('/')) {
						setStatus('执行命令…');
						try {
							const res = await api(API.command, jsonPost({ sessionId: id, line: text }));
							setPreviews((prev) => {
								const cur = prev[id];
								const msgs = (cur && cur.messages) || [];
								const outText = (res && res.ok) ? ((res.text || '').slice(0, 4000)) : ('命令执行失败：' + ((res && res.error) || '未知错误'));
								return Object.assign({}, prev, { [id]: Object.assign({}, cur || { title: '', error: '' }, { loading: false, messages: msgs.concat([{ role: 'assistant', text: outText || '✓', time: Date.now(), src: 'assistant' }]) }) });
							});
							setStatus((res && res.ok) ? '命令已执行' : '命令执行失败');
						} catch (e) {
							setStatus('命令执行失败：' + String((e && e.message) || e));
						} finally {
							setChatBusy((prev) => Object.assign({}, prev, { [id]: false }));
							ensurePreview(id, true);
						}
						return;
					}
					try {
						const res = await api(API.chat, jsonPost({ sessionId: id, text: text }));
						if (res && res.ok) {
							if (res.agentError) setStatus('对话出错：' + res.agentError);
							else if (res.reply) setStatus('已收到回复');
							else setStatus('未收到回复（模型可能未响应）');
						} else {
							setStatus('对话失败：' + ((res && res.error) || '未知错误'));
						}
					} catch (e) {
						if (e && e.code === 'not-running') setStatus('会话不在运行中，请先打开它再对话');
						else if (e && e.code === 'no-model') setStatus('该会话缺少模型配置（旧版本创建），请删除卡片后重新创建');
						else setStatus('对话失败：' + String((e && e.message) || e));
					} finally {
						setChatBusy((prev) => Object.assign({}, prev, { [id]: false }));
						ensurePreview(id, true);
					}
				};
				const openInApp = (id) => {
					if (sessionsSvc && typeof sessionsSvc.open === 'function') {
						try { sessionsSvc.open(id); } catch (e) { /* ignore */ }
					}
				};

				// ---------- remove / resize ----------
				const removeNode = (id) => {
					setLayout((prev) => {
						const nodes = Object.assign({}, prev.nodes);
						delete nodes[id];
						return { nodes: nodes, edges: prev.edges.filter((e) => e.from !== id && e.to !== id) };
					});
					setSelected((prev) => { const n = Object.assign({}, prev); delete n[id]; return n; });
					setPreviews((prev) => { const n = Object.assign({}, prev); delete n[id]; return n; });
					setChatOpen((prev) => { const n = Object.assign({}, prev); delete n[id]; return n; });
					setChatBusy((prev) => { const n = Object.assign({}, prev); delete n[id]; return n; });
					setChatDrafts((prev) => { const n = Object.assign({}, prev); delete n[id]; return n; });
					setDetailId((prev) => prev === id ? null : prev);
					setStatus('已从画布移除卡片（会话本身不受影响）');
				};
				const deleteSession = async (id) => {
					if (sessionDeleting[id]) return;
					if (!workspacesSvc || typeof workspacesSvc.archiveSession !== 'function') {
						setStatus('无法删除会话：workspaces 服务不可用');
						return;
					}
					const session = sessionById[id];
					const label = (session && session.title) || id;
					const confirmed = typeof window !== 'undefined' && window.confirm(
						'确定删除会话“' + label + '”吗？\n\n会话将从列表中隐藏，可在 DSH 的归档中恢复。',
					);
					if (!confirmed) return;
					setSessionDeleting((prev) => Object.assign({}, prev, { [id]: true }));
					setStatus('正在删除会话“' + label + '”…');
					try {
						await workspacesSvc.archiveSession(id);
						removeNode(id);
						setSessions((prev) => Array.isArray(prev) ? prev.filter((item) => item.id !== id) : prev);
						setStatus('已删除会话“' + label + '”（可在归档中恢复）');
					} catch (e) {
						setStatus('删除会话失败：' + String((e && e.message) || e));
					} finally {
						setSessionDeleting((prev) => { const n = Object.assign({}, prev); delete n[id]; return n; });
					}
				};
				const resizeNode = (id, w, h) => {
					setLayout((prev) => {
						const n = prev.nodes[id];
						if (!n) return prev;
						return { nodes: Object.assign({}, prev.nodes, { [id]: { x: n.x, y: n.y, w: Math.max(200, Math.round(w)), h: Math.max(120, Math.round(h)) } }), edges: prev.edges };
					});
				};

				// attach a session to the workspace matching its path (so the main
				// UI groups it correctly, not under 未分组)
				const attachWorkspace = async (sessionId, cwd) => {
					if (!workspacesSvc || typeof workspacesSvc.insertSessionBefore !== 'function') {
						setStatus('新会话已创建（workspaces 服务不可用）');
						return;
					}
					if (!cwd) return;
					try {
						const ws = workspaces.find((w) => w.path === cwd);
						if (!ws || !ws.id) {
							setStatus('新会话已创建（未找到匹配工作区：' + cwd + '）');
							return;
						}
						await workspacesSvc.insertSessionBefore(ws.id, sessionId);
						setStatus('新会话已创建并挂载到工作区');
					} catch (e) {
						setStatus('新会话已创建（挂载失败：' + String((e && e.message) || e) + '）');
					}
				};

				// ---------- new blank session ----------
				const [creatingNew, setCreatingNew] = React.useState(false);
				const newSession = async () => {
					setCreatingNew(true);
					setStatus('正在创建新会话…');
					try {
						const res = await api(API.newSession, jsonPost({ cwd: wsPath || '' }));
						if (res && res.ok) {
							addNode(res.sessionId);
							await attachWorkspace(res.sessionId, wsPath || '');
							loadWorkspace(wsPath);
							setStatus('已创建空白会话卡片，可与其他卡片连线');
						} else {
							setStatus('创建失败：' + ((res && res.error) || '未知错误'));
						}
					} catch (e) {
						setStatus('创建失败：' + String((e && e.message) || e));
					} finally {
						setCreatingNew(false);
					}
				};

				// ---------- create summary ----------
				const createSummary = async (prompt) => {
					const ids = selectedIds;
					if (!ids.length) return { ok: false, error: '未选择任何会话' };
					setStatus('正在创建汇总会话…');
					try {
						const res = await api(API.create, jsonPost({ sessionIds: ids, prompt: prompt || '', cwd: wsPath || '' }));
						if (res && res.ok) {
							// add new node + auto edges from each selected session to the new session
							setLayout((prev) => {
								const count = Object.keys(prev.nodes).length;
								const x = 60 + (count % 5) * 40;
								const y = 70 + Math.floor(count / 5) * 30;
								const nodes = Object.assign({}, prev.nodes, { [res.sessionId]: { x: x, y: y, w: 250, h: 170 } });
								const edges = prev.edges.slice();
								for (const sid of ids) {
									if (sid !== res.sessionId) edges.push({ from: sid, to: res.sessionId });
								}
								return { nodes: nodes, edges: edges };
							});
							setModal(false);
							setSelected({});
							setStatus('已创建汇总会话并自动连线');
							// refresh sessions so the new session appears in the library
							await attachWorkspace(res.sessionId, wsPath || '');
							loadWorkspace(wsPath);
							if (sessionsSvc && typeof sessionsSvc.open === 'function') {
								try { sessionsSvc.open(res.sessionId); } catch (e) { /* ignore */ }
							}
							return { ok: true };
						}
						setStatus('创建失败：' + ((res && res.error) || '未知错误'));
						return { ok: false, error: (res && res.error) || '创建失败' };
					} catch (e) {
						setStatus('创建失败：' + String((e && e.message) || e));
						return { ok: false, error: String((e && e.message) || e) };
					}
				};

				// ---------- render: edges ----------
				const edgesEls = [];
				for (let i = 0; i < layout.edges.length; i++) {
					const ed = layout.edges[i];
					const a = layout.nodes[ed.from];
					const b = layout.nodes[ed.to];
					if (!a || !b) continue;
					const ax = a.x + a.w / 2;
					const ay = a.y + a.h / 2;
					const bx = b.x + b.w / 2;
					const by = b.y + b.h / 2;
					const mx = (ax + bx) / 2;
					const my = (ay + by) / 2;
					edgesEls.push(
						React.createElement('g', { key: 'e' + i },
							React.createElement('line', { x1: ax, y1: ay, x2: bx, y2: by, className: 'dsc-edge', markerEnd: 'url(#dsc-arrow)' }),
							React.createElement('line', { x1: ax, y1: ay, x2: bx, y2: by, className: 'dsc-edge-hit', onClick: () => removeEdge(i) }),
							React.createElement('g', { className: 'dsc-edge-del', transform: 'translate(' + mx + ',' + my + ')', onClick: (ev) => { ev.stopPropagation(); removeEdge(i); } },
								React.createElement('circle', { r: 8, fill: 'var(--dsw-alias-bg-layer-2, #2a2a2e)', stroke: 'var(--dsw-alias-border-l1, #333)' }),
								React.createElement('text', { x: 0, y: 2.5, textAnchor: 'middle', fontSize: 10, fill: 'var(--dsw-alias-label-secondary, #888)' }, '✕'),
							),
						),
					);
				}
				// drag preview line
				if (dragEdge) {
					const from = layout.nodes[dragEdge.from];
					if (from) {
						const ax = from.x + from.w / 2;
						const ay = from.y + from.h / 2;
						edgesEls.push(
							React.createElement('line', { key: 'preview', x1: ax, y1: ay, x2: dragEdge.x, y2: dragEdge.y, className: 'dsc-edge-preview' }),
						);
					}
				}

				// ---------- render: nodes ----------
				const nodeEls = [];
				for (const id of nodeIds) {
					const n = layout.nodes[id];
					const s = sessionById[id];
					const prev = previews[id];
					nodeEls.push(React.createElement(NodeCard, {
						key: id,
						id: id,
						session: s,
						node: n,
						selected: !!selected[id],
						isDropTarget: dropTarget === id,
						preview: prev,
						chatView: !!chatOpen[id],
						chatBusy: !!chatBusy[id],
						deleting: !!sessionDeleting[id],
						chatDraft: chatDrafts[id] || '',
						onMove: moveNode,
						onDragEnd: () => {},
						onClick: onNodeClick,
						onOpen: onNodeOpen,
						onPreview: onPreview,
						onToggleChat: toggleChat,
						onChatDraft: onChatDraft,
						onSend: onSend,
						onOpenInApp: openInApp,
						onRemove: removeNode,
						onDeleteSession: deleteSession,
						onResize: resizeNode,
						slashCandidates: slashCandidates,
						onSkillInject: onSkillInject,
						onSlashLoaded: ensureSlashCandidates,
						onPortDown: (e, nodeId) => startPortDrag(e, nodeId),
						onPortOver: (id) => setDropTarget(id),
						onPortLeave: () => setDropTarget(null),
					}));
				}

				// ---------- port long-press drag ----------
				function startPortDrag(e, nodeId) {
					e.stopPropagation();
					const start = Date.now();
					let dragging = false;
					let moved = false;
					const timer = setTimeout(() => { dragging = true; moved = false; }, 450);
					const onMove = (ev) => {
						if (!dragging) return;
						moved = true;
						setDragEdge({ from: nodeId, x: ev.clientX, y: ev.clientY });
						const el = document.elementFromPoint(ev.clientX, ev.clientY);
						const nodeEl = el && el.closest ? el.closest('.dsc-node') : null;
						setDropTarget(nodeEl ? nodeEl.dataset.id : null);
					};
					const onUp = (ev) => {
						clearTimeout(timer);
						document.removeEventListener('pointermove', onMove);
						document.removeEventListener('pointerup', onUp);
						if (dragging) {
							const el = document.elementFromPoint(ev.clientX, ev.clientY);
							const nodeEl = el && el.closest ? el.closest('.dsc-node') : null;
							const targetId = nodeEl ? nodeEl.dataset.id : null;
							setDragEdge(null);
							setDropTarget(null);
							if (targetId && targetId !== nodeId) addEdge(nodeId, targetId);
							else setStatus('拖到目标会话卡片上即可连线');
						}
					};
					document.addEventListener('pointermove', onMove);
					document.addEventListener('pointerup', onUp);
				}

				// ---------- render: library ----------
				const libraryEls = [];
				if (Array.isArray(sessions)) {
					for (const s of sessions) {
						const added = !!layout.nodes[s.id];
						libraryEls.push(React.createElement('div', {
							key: s.id,
							className: 'dsc-library-item',
							title: added ? '该会话已在画布中' : '点击添加到当前画面中央',
							onClick: () => { if (!added) addNode(s.id, 'center'); },
						},
							React.createElement('span', { className: 't', title: s.id + (s.cwd ? ' · ' + s.cwd : '') }, s.title || s.id),
							added
								? React.createElement('span', { className: 'added' }, '✓')
								: React.createElement('span', { className: 'add' }, '+'),
						));
					}
				}

				const detailBody = detailId ? previews[detailId] : null;
				const detailTitle = detailBody && detailBody.title ? detailBody.title : ((detailId && sessionById[detailId] && sessionById[detailId].title) || '');
				const currentWsName = (() => {
					for (const w of workspaces) { if (w.path === wsPath) return w.title || w.path; }
					return wsPath || '默认';
				})();

				return React.createElement('div', { className: 'dsc-canvas', tabIndex: 0, onKeyDown: onKeyDown },
					React.createElement('div', { className: 'dsc-toolbar' },
						React.createElement('h1', null, '会话画布'),
						React.createElement('select', {
							className: 'dsc-ws-select',
							value: wsPath,
							onChange: (e) => switchWorkspace(e.target.value),
							title: '每个工作区是一个独立画布',
						},
							React.createElement('option', { value: '' }, '所有会话'),
							workspaces.map((w) => React.createElement('option', { key: w.id || w.path, value: w.path }, (w.title || w.path))),
						),
						React.createElement('span', { className: 'dsc-ws', style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #888)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, currentWsName),
						React.createElement('span', { className: 'spacer' }),
						React.createElement('button', {
							className: 'dsc-btn',
							onClick: () => loadWorkspace(wsPath),
						}, '刷新'),
						React.createElement('button', {
							className: 'dsc-btn',
							onClick: newSession,
							disabled: creatingNew,
							title: '创建一个空白会话卡片，可与其他卡片连线后对话',
						}, creatingNew ? '创建中…' : '新对话'),
						React.createElement('button', { className: 'dsc-btn danger', onClick: clearCanvas }, '清空'),
						React.createElement('button', {
							className: 'dsc-btn primary',
							disabled: !selectedIds.length,
							onClick: () => setModal(true),
							title: '基于选中的 ' + selectedIds.length + ' 个会话创建新会话（自动连线）',
						}, '创建汇总会话 (' + selectedIds.length + ')'),
						React.createElement('button', { className: 'dsc-btn', onClick: () => setOpen(false) }, '关闭'),
					),
					React.createElement('div', {
						className: 'dsc-canvas-body',
						ref: canvasBodyRef,
						onClick: () => { setSelected({}); },
					},
						React.createElement('div', { className: 'dsc-canvas-bg' }),
						React.createElement('svg', { className: 'dsc-svg' },
							React.createElement('defs', null,
								React.createElement('marker', { id: 'dsc-arrow', markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto' },
									React.createElement('path', { d: 'M0,0 L8,4 L0,8 z', fill: 'var(--dsw-alias-label-secondary, #888)' }),
								),
							),
							edgesEls,
						),
						nodeEls,
						React.createElement('div', { className: 'dsc-library', onClick: (e) => e.stopPropagation() },
							React.createElement('div', { className: 'dsc-library-head' },
								React.createElement('span', null, '会话库'),
								React.createElement('span', { className: 'spacer' }),
								React.createElement('span', null, loading ? '加载中…' : (Array.isArray(sessions) ? sessions.length : 0) + ' 个'),
							),
							React.createElement('div', { className: 'dsc-library-list' }, libraryEls),
						),
						detailId ? React.createElement('div', { className: 'dsc-detail', onClick: (e) => e.stopPropagation() },
							React.createElement('div', { className: 'dsc-detail-head' },
								React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, detailTitle || detailId),
								React.createElement('button', { className: 'dsc-btn', onClick: () => setDetailId(null) }, '✕'),
							),
							React.createElement('div', { className: 'dsc-detail-body' }, renderDetailBody(detailBody)),
						) : null,
						(!nodeIds.length) ? React.createElement('div', { className: 'dsc-empty' },
							'从左侧「会话库」点击 + 添加会话卡片\n点工具栏「新对话」创建空白会话卡片\n卡片底部「对话」可在此直接对话\n长按卡片边缘的蓝色圆点拖到另一张卡片即可建立连接\n选中多张卡片后点击「创建汇总会话」生成新会话并自动连线',
						) : null,
						modal ? React.createElement(CreateModal, { count: selectedIds.length, onCancel: () => setModal(false), onCreate: createSummary }) : null,
					),
					React.createElement('div', { className: 'dsc-statusbar' },
						React.createElement('span', null, '选中 ' + selectedIds.length + ' · 节点 ' + nodeIds.length + ' · 连线 ' + layout.edges.length),
						React.createElement('span', { className: 'dsc-error' }, loadError || status || ''),
					),
				);
			}

			function renderDetailBody(body) {
				if (!body) return React.createElement('div', { className: 'dsc-node-empty' }, '加载中…');
				if (body.loading) return React.createElement('div', { className: 'dsc-node-empty' }, '加载中…');
				if (body.error) return React.createElement('div', { className: 'dsc-error' }, body.error);
				if (!body.messages || !body.messages.length) return React.createElement('div', { className: 'dsc-node-empty' }, '（暂无对话内容）');
				const els = [];
				for (const m of body.messages) {
					const roleLabel = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '工具';
					els.push(React.createElement('div', { key: els.length, className: 'dsc-msg ' + m.role },
						React.createElement('div', { className: 'role' }, roleLabel),
						React.createElement('div', null, m.text),
					));
				}
				return els;
			}

			// ---------- node card ----------
			function NodeCard(props) {
				const movedRef = React.useRef(false);
				const slashMenuRef = React.useRef(null);
				const imeComposingRef = React.useRef(false);
				const imeEnterGuardUntilRef = React.useRef(0);
				const [slashOpen, setSlashOpen] = React.useState(false);
				const [slashQuery, setSlashQuery] = React.useState('');
				const [slashIndex, setSlashIndex] = React.useState(0);
				React.useEffect(() => {
					if (!props.preview) props.onPreview(props.id);
				}, [props.id]);

				const onPointerDown = (e) => {
					if (e.button !== 0) return;
					e.stopPropagation();
					const el = e.currentTarget;
					try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
					const startX = e.clientX;
					const startY = e.clientY;
					const origX = props.node.x;
					const origY = props.node.y;
					movedRef.current = false;
					const onMove = (ev) => {
						const dx = ev.clientX - startX;
						const dy = ev.clientY - startY;
						if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
						props.onMove(props.id, origX + dx, origY + dy);
					};
					const onUp = () => {
						el.removeEventListener('pointermove', onMove);
						el.removeEventListener('pointerup', onUp);
						props.onDragEnd();
					};
					el.addEventListener('pointermove', onMove);
					el.addEventListener('pointerup', onUp);
				};
				const onClick = (e) => {
					e.stopPropagation();
					if (movedRef.current) return;
					props.onClick(props.id, e);
				};
				const onDoubleClick = (e) => {
					e.stopPropagation();
					if (movedRef.current) return;
					props.onOpen(props.id);
				};

				const s = props.session;
				const title = (props.preview && props.preview.title) || (s && s.title) || props.id;
				const previewText = props.preview
					? (props.preview.loading ? '加载中…' : props.preview.error ? props.preview.error : (props.preview.messages && props.preview.messages.length)
						? props.preview.messages[props.preview.messages.length - 1].text
						: '（暂无对话内容）')
					: '加载中…';
				const sub = (s ? (s.live ? '● 活跃' : '○ 未运行') + ' · ' : '') +
					(s && s.lastActive ? new Date(s.lastActive).toLocaleString() : '') +
					(s && s.cwd ? ' · ' + s.cwd : '');

				// chat rows
				let bodyEl;
				if (props.chatView) {
					// Only show real conversation: user input (src === 'user') and
					// model replies (assistant). Filter out injected runtime-context
					// and recall messages so the card reads like the main chat view.
					const msgs = (props.preview && props.preview.messages) || [];
					const visible = msgs.filter((m) => (m.role === 'assistant') || (m.role === 'user' && m.src === 'user'));
					const rows = visible.slice(-10).map((m, idx) => {
						const who = m.role === 'user' ? '我' : 'AI';
						return React.createElement('div', { key: idx, className: 'dsc-chat-row ' + m.role },
							React.createElement('span', { className: 'who' }, who + '：'),
							React.createElement('span', null, m.text),
						);
					});
					if (!rows.length && props.preview && !props.preview.loading) {
						rows.push(React.createElement('div', { key: 'empty', className: 'dsc-chat-row' }, '（暂无对话，输入内容开始）'));
					}
					if (props.chatBusy) {
						rows.push(React.createElement('div', { key: 'busy', className: 'dsc-chat-row assistant' },
							React.createElement('span', { className: 'who' }, 'AI：'),
							React.createElement('span', { className: 'dsc-thinking' }, '思考中…'),
						));
					}
					// slash "/" suggestion menu (commands + skills)
					let slashItems = [];
					if (props.slashCandidates) {
						// Keep suggestions visible for `/skill-name task text` and pass
						// the text after the first space as that skill's concrete task.
						const q = slashQuery.trimStart().split(/\s+/, 1)[0].toLowerCase();
						for (const c of props.slashCandidates.commands || []) {
							if (!q || String(c.name || '').toLowerCase().startsWith(q)) {
								slashItems.push({ type: 'command', name: '/' + c.name, description: c.description || '', insert: '/' + c.name + ' ' });
							}
						}
						for (const s of props.slashCandidates.skills || []) {
							if (!q || String(s.name || '').toLowerCase().includes(q)) {
								slashItems.push({ type: 'skill', name: s.name, description: s.description || '' });
							}
						}
					}
					slashItems = slashItems.slice(0, 12);
					const activeSlashIndex = slashItems.length ? Math.min(slashIndex, slashItems.length - 1) : 0;
					const skillTaskText = () => {
						const typed = slashQuery.trim();
						const splitAt = typed.search(/\s/);
						return splitAt >= 0 ? typed.slice(splitAt).trim() : '';
					};
					const completeSlashItem = (item) => {
						const typed = slashQuery.trimStart();
						const splitAt = typed.search(/\s/);
						const suffix = splitAt >= 0 ? typed.slice(splitAt).trimStart() : '';
						const name = item.type === 'command' ? item.name : '/' + item.name;
						const completed = name + ' ' + suffix;
						props.onChatDraft(props.id, completed);
						setSlashQuery(completed.slice(1));
						setSlashOpen(true);
						setSlashIndex(0);
					};
					const activateSlashItem = (item) => {
						setSlashOpen(false);
						if (item.type === 'skill') {
							props.onSkillInject(props.id, item.name, skillTaskText());
						} else {
							props.onChatDraft(props.id, item.insert);
						}
					};
					const moveSlashSelection = (delta) => {
						if (!slashItems.length) return;
						setSlashIndex((current) => {
							const safe = Math.min(current, slashItems.length - 1);
							const next = (safe + delta + slashItems.length) % slashItems.length;
							setTimeout(() => {
								const menu = slashMenuRef.current;
								const selected = menu && menu.querySelector('[data-slash-index="' + next + '"]');
								if (selected && typeof selected.scrollIntoView === 'function') selected.scrollIntoView({ block: 'nearest' });
							}, 0);
							return next;
						});
					};
					const onInputChange = (e) => {
						const v = e.target.value;
						props.onChatDraft(props.id, v);
						if (v.startsWith('/')) {
							props.onSlashLoaded();
							setSlashOpen(true);
							setSlashQuery(v.slice(1));
							setSlashIndex(0);
						} else {
							setSlashOpen(false);
						}
					};
					bodyEl = React.createElement('div', { className: 'dsc-chat' },
						React.createElement('div', { className: 'dsc-chat-list', onPointerDown: (e) => e.stopPropagation() }, rows),
						React.createElement('div', { className: 'dsc-chat-input-row' },
							(slashOpen && slashItems.length > 0) ? React.createElement('div', { ref: slashMenuRef, className: 'dsc-slash-menu', onPointerDown: (e) => e.stopPropagation() },
								slashItems.map((item, i) => React.createElement('div', {
									key: i,
									className: 'dsc-slash-item' + (item.type === 'skill' ? ' skill' : '') + (i === activeSlashIndex ? ' active' : ''),
									'data-slash-index': i,
									title: item.description,
									onMouseEnter: () => setSlashIndex(i),
									onMouseDown: (e) => {
										e.preventDefault();
										activateSlashItem(item);
									},
								},
									React.createElement('span', { className: 'n' }, item.name),
									React.createElement('span', { className: 'd' }, item.description.slice(0, 36)),
								)),
							) : null,
							React.createElement('input', {
								value: props.chatDraft,
								placeholder: '在此直接对话…（输入 / 可调用命令或 skill）',
								onPointerDown: (e) => e.stopPropagation(),
								onChange: onInputChange,
								onCompositionStart: () => {
									imeComposingRef.current = true;
									imeEnterGuardUntilRef.current = 0;
								},
								onCompositionEnd: () => {
									imeComposingRef.current = false;
									// Safari/WebKit may emit compositionend before the Enter
									// keydown used to confirm the chosen candidate.
									imeEnterGuardUntilRef.current = Date.now() + 120;
								},
								onBlur: () => {
									imeComposingRef.current = false;
									imeEnterGuardUntilRef.current = 0;
									setSlashOpen(false);
								},
								onKeyDown: (e) => {
									const nativeEvent = e.nativeEvent || e;
									const composing = imeComposingRef.current || e.isComposing || nativeEvent.isComposing || e.keyCode === 229 || nativeEvent.keyCode === 229;
									if (composing) return;
									if (e.key === 'Enter' && Date.now() < imeEnterGuardUntilRef.current) {
										e.preventDefault();
										imeEnterGuardUntilRef.current = 0;
										return;
									}
									if (e.key === 'Escape') { setSlashOpen(false); return; }
									if (slashOpen && slashItems.length) {
										if (e.key === 'ArrowDown') { e.preventDefault(); moveSlashSelection(1); return; }
										if (e.key === 'ArrowUp') { e.preventDefault(); moveSlashSelection(-1); return; }
										if (e.key === 'Tab') { e.preventDefault(); completeSlashItem(slashItems[activeSlashIndex]); return; }
										if (e.key === 'Enter' && slashItems[activeSlashIndex].type === 'skill') {
											e.preventDefault();
											activateSlashItem(slashItems[activeSlashIndex]);
											return;
										}
										if (e.key === 'Enter' && slashItems[activeSlashIndex].type === 'command') {
											const selected = slashItems[activeSlashIndex];
											const typedName = '/' + slashQuery.trimStart().split(/\s+/, 1)[0];
											if (typedName.toLowerCase() !== selected.name.toLowerCase()) {
												e.preventDefault();
												completeSlashItem(selected);
												return;
											}
											setSlashOpen(false);
										}
									}
									if (e.key === 'Enter') props.onSend(props.id);
								},
								'aria-expanded': slashOpen && slashItems.length > 0,
								title: '输入 / 调用命令或 skill；↑↓ 选择，Tab 补全',
								disabled: props.chatBusy,
							}),
							React.createElement('button', {
								onPointerDown: (e) => e.stopPropagation(),
								onClick: () => props.onSend(props.id),
								disabled: props.chatBusy,
							}, props.chatBusy ? '…' : '发送'),
						),
					);
				} else {
					bodyEl = React.createElement('div', { className: 'dsc-node-body' }, previewText);
				}

				const ports = [
					React.createElement('div', {
						key: 'top', className: 'dsc-port top',
						onPointerDown: (e) => props.onPortDown(e, props.id),
						onMouseEnter: () => props.onPortOver(props.id),
						onMouseLeave: () => props.onPortLeave(),
						title: '长按并拖到目标会话卡片建立连接（内容注入）',
					}),
					React.createElement('div', {
						key: 'bottom', className: 'dsc-port bottom',
						onPointerDown: (e) => props.onPortDown(e, props.id),
						onMouseEnter: () => props.onPortOver(props.id),
						onMouseLeave: () => props.onPortLeave(),
						title: '长按并拖到目标会话卡片建立连接（内容注入）',
					}),
					React.createElement('div', {
						key: 'left', className: 'dsc-port left',
						onPointerDown: (e) => props.onPortDown(e, props.id),
						onMouseEnter: () => props.onPortOver(props.id),
						onMouseLeave: () => props.onPortLeave(),
						title: '长按并拖到目标会话卡片建立连接（内容注入）',
					}),
					React.createElement('div', {
						key: 'right', className: 'dsc-port right',
						onPointerDown: (e) => props.onPortDown(e, props.id),
						onMouseEnter: () => props.onPortOver(props.id),
						onMouseLeave: () => props.onPortLeave(),
						title: '长按并拖到目标会话卡片建立连接（内容注入）',
					}),
				];

				// resize handle drag (bottom-right corner)
				const onResizeDown = (e) => {
					e.stopPropagation();
					const el = e.currentTarget;
					try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
					const startX = e.clientX;
					const startY = e.clientY;
					const origW = props.node.w;
					const origH = props.node.h;
					const onMove = (ev) => {
						const dw = ev.clientX - startX;
						const dh = ev.clientY - startY;
						props.onResize(props.id, origW + dw, origH + dh);
					};
					const onUp = () => {
						el.removeEventListener('pointermove', onMove);
						el.removeEventListener('pointerup', onUp);
					};
					el.addEventListener('pointermove', onMove);
					el.addEventListener('pointerup', onUp);
				};

				return React.createElement('div', {
					className: 'dsc-node' + (props.selected ? ' selected' : '') + (props.isDropTarget ? ' drop-target' : ''),
					style: { left: props.node.x, top: props.node.y, width: props.node.w, height: props.node.h },
					'data-id': props.id,
					onPointerDown: onPointerDown,
					onClick: onClick,
					onDoubleClick: onDoubleClick,
					title: '拖拽移动 · 单击选中 · 双击查看详情 · 右下角调整大小',
				},
					React.createElement('div', { className: 'dsc-node-head' },
						React.createElement('div', { className: 'dsc-node-title' }, title),
						React.createElement('div', { className: 'dsc-node-sub' }, sub),
					),
					bodyEl,
					React.createElement('div', { className: 'dsc-node-footer' },
						React.createElement('button', { onPointerDown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); props.onToggleChat(props.id); } }, props.chatView ? '摘要' : '对话'),
						React.createElement('button', { onPointerDown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); props.onOpen(props.id); } }, '详情'),
						React.createElement('span', { className: 'spacer' }),
						React.createElement('button', {
							className: 'danger',
							onPointerDown: (e) => e.stopPropagation(),
							onClick: (e) => { e.stopPropagation(); props.onDeleteSession(props.id); },
							disabled: props.deleting,
							title: '删除该会话（归档后可恢复）',
						}, props.deleting ? '删除中…' : '删除会话'),
					),
					React.createElement('div', {
						className: 'dsc-node-del',
						onPointerDown: (e) => e.stopPropagation(),
						onClick: (e) => { e.stopPropagation(); props.onRemove(props.id); },
						title: '从画布移除该卡片',
					}, '✕'),
					React.createElement('div', {
						className: 'dsc-resize-handle',
						onPointerDown: onResizeDown,
						title: '拖拽调整卡片大小',
					}),
					ports,
				);
			}

			// ---------- create modal ----------
			function CreateModal({ count, onCancel, onCreate }) {
				const [prompt, setPrompt] = React.useState('');
				const [busy, setBusy] = React.useState(false);
				const [err, setErr] = React.useState('');
				const submit = async () => {
					setBusy(true);
					setErr('');
					const res = await onCreate(prompt);
					if (!res || !res.ok) {
						setErr((res && res.error) || '创建失败');
						setBusy(false);
					}
				};
				return React.createElement('div', { className: 'dsc-modal-mask', onClick: () => { if (!busy) onCancel(); } },
					React.createElement('div', { className: 'dsc-modal', onClick: (e) => e.stopPropagation() },
						React.createElement('h2', null, '创建汇总会话（' + count + ' 个会话）'),
						React.createElement('textarea', {
							placeholder: '对新会话的指令（可选），例如：总结以上各会话的要点、关键结论与分歧，并给出下一步建议',
							value: prompt,
							onChange: (e) => setPrompt(e.target.value),
							disabled: busy,
						}),
						err ? React.createElement('div', { className: 'dsc-error' }, err) : null,
						React.createElement('div', { className: 'dsc-modal-actions' },
							React.createElement('button', { className: 'dsc-btn', onClick: onCancel, disabled: busy }, '取消'),
							React.createElement('button', { className: 'dsc-btn primary', onClick: submit, disabled: busy }, busy ? '创建中…' : '创建并打开'),
						),
					),
				);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
