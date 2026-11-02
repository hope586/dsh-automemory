window.__ModuleLoader__.load({id:'dsh-automemory',factory:require=>{const React=require('react');const NativeMarkdown=require('@deepseek-ai/dsh-client-ui-primitives').MarkdownText;const STYLE="/* DSH semantic tokens: light/dark appearance follows the host. */\n.dam-root {\n  --dam-text:var(--dsw-alias-label-primary,#0f1115);\n  --dam-secondary:var(--dsw-alias-label-secondary,#61666b);\n  --dam-muted:var(--dsw-alias-label-tertiary,#81858c);\n  --dam-border:var(--dsw-alias-border-l2,rgba(0,0,0,.1));\n  --dam-border-strong:var(--dsw-alias-border-l4,rgba(0,0,0,.16));\n  --dam-surface:var(--dsw-alias-bg-base,#fff);\n  --dam-raised:var(--dsw-alias-bg-layer-1,#fff);\n  --dam-soft:var(--dsw-specific-sidebar-fill,#f9fafb);\n  --dam-bg:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));\n  --dam-selected:var(--dsw-specific-sidebar-nav-item-active-accent,#e4edfd);\n  --dam-accent:var(--dsw-alias-state-business-primary,#4176e6);\n  --dam-error:var(--dsw-alias-state-error-primary,#ec1313);\n  --dam-warning:var(--dsw-alias-state-warn-label,#dd8629);\n  --dam-success:var(--dsw-alias-state-success-primary,#22c55e);\n  --dam-ease:var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));\n  --dam-duration:var(--ds-transition-duration,.2s);\n  box-sizing:border-box;min-width:0;min-height:0;height:100%;overflow:auto;\n  color:var(--dam-text);background:var(--dam-surface);\n  font-family:var(--dsw-font-family,inherit);font-size:13px;line-height:1.55;scrollbar-gutter:stable;\n}\n.dam-root *,.dam-root *::before,.dam-root *::after{box-sizing:border-box}\n.dam-root:not(.dam-page){padding:16px}\n.dam-page{--dam-page-gutter:clamp(20px,4vw,56px);--dam-page-top:32px;container-type:inline-size;padding:max(var(--dam-page-top),var(--dsh-frame-top-clearance,0px)) var(--dam-page-gutter) 40px}\n.dam-shell{width:100%;max-width:1120px;margin:0 auto}\n.dam-root :is(h1,h2,h3,h4,p){margin:0}\n.dam-root :is(button,input,select,textarea){font:inherit;color:inherit;border-radius:8px}\n.dam-root button{cursor:pointer}\n.dam-root :is(button,input,select,textarea):disabled{cursor:default;opacity:.45}\n.dam-root :is(button,input,textarea,select,summary,a):focus-visible{outline:2px solid var(--dam-accent);outline-offset:3px}\n.dam-root :is(input:not([type=checkbox]):not([type=radio]),select,textarea){width:100%;min-width:0;border:1px solid var(--dam-border);background:var(--dam-surface);padding:9px 11px;transition:border-color var(--dam-duration) var(--dam-ease),background var(--dam-duration) var(--dam-ease)}\n.dam-root :is(input:not([type=checkbox]):not([type=radio]),select,textarea):hover:not(:disabled){border-color:var(--dam-border-strong)}\n.dam-root input[type=search]{appearance:none}\n.dam-root input[type=checkbox]{accent-color:var(--dam-accent);flex:none;width:15px;height:15px}\n.dam-root textarea{resize:vertical;min-height:110px;line-height:1.65}\n.dam-root :is(input,textarea)::placeholder{color:var(--dam-muted);opacity:1}\n.dam-root fieldset{min-width:0}\n.dam-root fieldset:disabled{opacity:.65}\n.dam-root time{font-variant-numeric:tabular-nums}\n.dam-root [hidden]{display:none!important}\n\n/* One heading, one project context, three primary destinations. */\n.dam-page-header,.dam-top,.dam-row,.dam-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}\n/* Window chrome only shifts the heading; the library keeps its full width. */\n.dam-page-header{align-items:flex-start;margin-bottom:24px;padding-inline-start:max(0px,calc(var(--dsh-frame-leading-clearance,0px) - var(--dam-page-gutter)))}\n.dam-heading{display:flex;flex-direction:column;gap:6px;min-width:0}\n.dam-title{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:600;line-height:1.35;letter-spacing:-.02em}\n.dam-title h1{font:inherit;letter-spacing:inherit}\n.dam-subtitle{color:var(--dam-muted);font-size:13px;line-height:1.6}\n.dam-header-actions,.dam-page-tools,.dam-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}\n.dam-header-actions{padding-top:2px}\n.dam-top{margin-bottom:16px}\n.dam-project-bar{display:flex;align-items:center;gap:16px;padding:12px 14px;margin-bottom:20px;background:var(--dam-soft);border:1px solid var(--dam-border);border-radius:12px}\n.dam-project-picker{display:flex;align-items:center;gap:10px;flex:1;max-width:none;min-width:0}\n.dam-project-picker>svg{flex:none;color:var(--dam-muted)}\n.dam-project-picker label,.dam-project-picker>span{display:block;margin-bottom:5px;color:var(--dam-muted);font-size:12px}\n.dam-project-picker select{flex:1;max-width:420px;min-width:0;font-weight:500;background:var(--dam-surface);text-overflow:ellipsis}\n.dam-project-meta{min-width:0;flex:1;color:var(--dam-muted);font-size:12px;overflow-wrap:anywhere}\n.dam-project-switch{flex:none;min-width:0;width:auto;margin-left:0}\n.dam-project-switch .dam-hint{max-width:240px}\n.dam-project{padding:0 0 16px;margin-bottom:16px;border-bottom:1px solid var(--dam-border)}\n.dam-project-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}\n.dam-navigation{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--dam-border);margin-bottom:24px}\n.dam-tabs{display:flex;align-items:stretch;gap:24px;margin:0 0 24px;border-bottom:1px solid var(--dam-border)}\n.dam-navigation .dam-tabs{border:0;margin:0}\n.dam-tabs button{position:relative;border:0;border-radius:3px;background:transparent;padding:10px 1px 12px;color:var(--dam-muted);font-size:14px;line-height:20px;white-space:nowrap;transition:color var(--dam-duration) var(--dam-ease)}\n.dam-tabs button:hover,.dam-tabs button[aria-selected=true]{color:var(--dam-text)}\n.dam-tabs button[aria-selected=true]{font-weight:500}\n.dam-tabs button::after{content:'';position:absolute;bottom:-1px;right:0;left:0;height:2px;border-radius:2px 2px 0 0;background:currentColor;opacity:0;transform:scaleX(.65);transition:opacity var(--dam-duration) var(--dam-ease),transform var(--dam-duration) var(--dam-ease)}\n.dam-tabs button[aria-selected=true]::after{opacity:1;transform:scaleX(1)}\n.dam-content{min-width:0;animation:dam-reveal .18s var(--dam-ease)}\n.dam-diagnostic-warning{margin-bottom:16px}\n.dam-page-tools{justify-content:space-between;margin-bottom:20px;gap:16px}\n.dam-page-tools h2{font-size:17px;font-weight:600;margin-bottom:3px}\n.dam-navigation .dam-page-tools{margin:0;justify-content:flex-end}\n.dam-muted{color:var(--dam-muted);font-size:12px;line-height:1.6}\n.dam-hint{color:var(--dam-muted);font-size:12px;line-height:1.65;margin-top:6px!important}\n.dam-section-head{align-items:flex-start;margin-bottom:4px}\n.dam-section-head h2,.dam-section-head h3{font-size:16px;font-weight:600}\n.dam-section-head>div{min-width:0}\n.dam-section{display:flex;flex-direction:column;gap:14px;min-width:0}\n.dam-section+.dam-section{margin-top:24px;padding-top:24px;border-top:1px solid var(--dam-border)}\n.dam-secondary-panel{max-width:800px;margin:0 auto;animation:dam-reveal .18s var(--dam-ease)}\n.dam-secondary-panel>.dam-section-head{margin-bottom:20px}\n\n/* Quiet controls; black/white primary buttons match first-party settings. */\n.dam-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;align-self:flex-start;min-height:36px;padding:7px 13px;border:1px solid var(--dam-border);background:var(--dam-surface);line-height:20px;font-weight:500;transition:color var(--dam-duration) var(--dam-ease),background var(--dam-duration) var(--dam-ease),border-color var(--dam-duration) var(--dam-ease)}\n.dam-button:hover:not(:disabled){background:var(--dam-bg);border-color:var(--dam-border-strong)}\n.dam-button.primary{color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--dsw-alias-button-primary-fill,#0f1115);border-color:transparent}\n.dam-button.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#43454a)}\n.dam-button.ghost{border-color:transparent;background:transparent}\n.dam-button.ghost:hover:not(:disabled){background:var(--dam-bg)}\n.dam-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:32px;height:32px;padding:6px;border:0;background:transparent;color:var(--dam-secondary);transition:background var(--dam-duration) var(--dam-ease),color var(--dam-duration) var(--dam-ease)}\n.dam-icon:hover:not(:disabled){color:var(--dam-text);background:var(--dam-bg)}\n.dam-link{align-self:flex-start;border:0;background:transparent;padding:3px 0;color:var(--dsw-alias-link,#4176e6)!important;text-align:left;text-underline-offset:3px}\n.dam-link:hover:not(:disabled),.dam-source-link:hover{text-decoration:underline}\n.dam-count,.dam-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:20px;border-radius:5px;padding:1px 6px;color:var(--dam-muted);background:var(--dam-bg);font-size:11px;font-weight:400;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap}\n.dam-count{margin-left:5px}\n.dam-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:28px}\n.dam-toggle>span{min-width:0}\n.dam-toggle input[type=checkbox]{appearance:none;position:relative;width:34px;height:20px;margin:0;border:0;border-radius:12px;background:var(--dsw-alias-label-dimmed,#e1e5ee);cursor:pointer;transition:background var(--dam-duration) var(--dam-ease)}\n.dam-toggle input[type=checkbox]::before{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground,#fff);box-shadow:0 1px 2px rgba(0,0,0,.12);transition:transform var(--dam-duration) var(--dam-ease)}\n.dam-toggle input[type=checkbox]:checked{background:var(--dsw-alias-button-primary-fill,#0f1115)}\n.dam-toggle input[type=checkbox]:checked::before{transform:translateX(14px)}\n.dam-toggle input[type=checkbox]:disabled{cursor:default}\n\n/* Brief index at left; readable content, not metadata, at right. */\n.dam-library{min-width:0}\n.dam-library-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}\n.dam-search{position:relative;flex:1;min-width:160px;max-width:340px}\n.dam-search>svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--dam-muted);pointer-events:none}\n.dam-root .dam-search:has(>svg) input[type=search]{padding-left:36px}\n.dam-filters{display:flex;align-items:center;flex-wrap:wrap;gap:4px}\n.dam-filters button{display:inline-flex;align-items:center;border:1px solid transparent;padding:6px 10px;color:var(--dam-muted);background:transparent;white-space:nowrap;transition:background var(--dam-duration) var(--dam-ease),color var(--dam-duration) var(--dam-ease)}\n.dam-filters button:hover{color:var(--dam-text);background:var(--dam-bg)}\n.dam-filters button[aria-pressed=true],.dam-filters button[aria-selected=true]{color:var(--dam-text);background:var(--dam-bg);font-weight:500}\n.dam-filters button .dam-count{background:transparent;padding-right:0}\n.dam-memory-layout{display:grid;grid-template-columns:minmax(260px,.9fr) minmax(0,1.6fr);min-height:440px;border:1px solid var(--dam-border);border-radius:14px;overflow:clip;background:var(--dam-surface)}\n.dam-memory-list{display:flex;flex-direction:column;align-self:stretch;gap:4px;min-width:0;padding:8px;border-right:1px solid var(--dam-border);background:var(--dam-soft)}\n.dam-memory-button{display:block;width:100%;min-width:0;padding:14px;border:1px solid transparent;border-radius:9px;color:var(--dam-text);background:transparent;text-align:left;transition:background var(--dam-duration) var(--dam-ease),border-color var(--dam-duration) var(--dam-ease)}\n.dam-memory-button:hover:not(:disabled){background:var(--dam-bg)}\n.dam-memory-button[aria-selected=true],.dam-memory-button[aria-pressed=true],.dam-memory-button[data-selected=true]{background:var(--dam-selected)}\n.dam-memory-button:focus-visible{outline-offset:-3px}\n.dam-memory-button .dam-row{align-items:flex-start;gap:8px}\n.dam-memory-title,.dam-memory-button strong{font-size:14px;font-weight:500;line-height:1.5;overflow-wrap:anywhere}\n.dam-memory-hint{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:5px!important;color:var(--dam-secondary);font-size:12px;line-height:1.6;overflow-wrap:anywhere}\n.dam-memory-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:9px;color:var(--dam-muted);font-size:11px}\n.dam-memory-button>.dam-memory-meta{margin-top:0;margin-bottom:7px}\n.dam-memory-title{display:block}\n.dam-reader{min-width:0;padding:26px 28px}\n.dam-reader-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid var(--dam-border)}\n.dam-reader-head h2,.dam-reader-head h3{font-size:20px;font-weight:600;line-height:1.45;overflow-wrap:anywhere}\n.dam-reader-head>div{min-width:0}\n.dam-reader-actions{display:flex;align-items:center;gap:6px;flex:none}\n.dam-reader-back{display:none}\n.dam-reader-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;min-height:340px;color:var(--dam-muted);text-align:center}\n.dam-reader-empty h3,.dam-empty-title{color:var(--dam-secondary);font-size:15px;font-weight:500}\n.dam-reader>.dam-empty-state{min-height:340px;padding:30px 12px}\n.dam-empty-icon{display:grid;place-items:center;width:46px;height:46px;margin-bottom:5px;border:1px solid var(--dam-border);border-radius:13px;background:var(--dam-soft);color:var(--dam-muted)}\n.dam-prose{min-width:0;font-size:14px;line-height:1.8;overflow-wrap:anywhere}\n.dam-prose>:first-child{margin-top:0}\n.dam-prose :is(p,ul,ol,blockquote,pre,table){margin:0 0 14px}\n.dam-prose :is(h1,h2,h3,h4){margin:22px 0 10px;font-weight:600;line-height:1.5}\n.dam-prose h1,.dam-prose h2{font-size:18px}\n.dam-prose h3,.dam-prose h4{font-size:15px}\n.dam-prose ul,.dam-prose ol{padding-left:22px}\n.dam-prose li+li{margin-top:4px}\n.dam-prose a{color:var(--dsw-alias-link,#4176e6);text-underline-offset:3px}\n.dam-prose blockquote{padding-left:14px;border-left:3px solid var(--dam-border-strong);color:var(--dam-secondary)}\n.dam-prose code{font-family:var(--ds-font-family-code,monospace);font-size:.88em;background:var(--dsw-alias-markdown-inline-code,#fafafa);border-radius:4px;padding:2px 4px}\n.dam-prose pre{padding:14px;background:var(--dsw-alias-markdown-code-block,#f9fafb);border:1px solid var(--dam-border);border-radius:9px;overflow:auto}\n.dam-prose pre code{padding:0;border:0;background:none;white-space:pre}\n.dam-prose table{display:block;width:max-content;max-width:100%;border-collapse:collapse;overflow:auto;font-size:12px}\n.dam-prose th,.dam-prose td{border:1px solid var(--dam-border);padding:7px 10px;text-align:left}\n.dam-prose th{background:var(--dam-soft);font-weight:500}\n.dam-prose img{max-width:100%;height:auto;border-radius:8px}\n.dam-prose hr{border:0;border-top:1px solid var(--dam-border);margin:20px 0}\n.dam-reader>.dam-disclosure{margin-top:22px}\n.dam-detail{margin-top:12px;border-top:1px solid var(--dam-border);padding-top:16px}\n.dam-detail-head{margin-bottom:12px}\n.dam-empty,.dam-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:40px 20px;color:var(--dam-muted);text-align:center}\n.dam-empty-state{min-height:240px}\n.dam-empty p,.dam-empty-state p{max-width:360px}\n.dam-empty-state h3{font-size:15px;font-weight:500;color:var(--dam-secondary);line-height:1.55}\n.dam-empty .dam-button,.dam-empty-state .dam-button{align-self:center;margin-top:6px}\n\n/* Evidence, receipts and conflicts are secondary, but always reachable. */\n.dam-root details{min-width:0}\n.dam-root summary{width:fit-content;max-width:100%;cursor:pointer;padding:7px 0;border-radius:3px;color:var(--dam-secondary);font-size:12px}\n.dam-root summary:hover{color:var(--dam-text)}\n.dam-root summary::marker{color:var(--dam-muted);font-size:.85em}\n.dam-disclosure{border-top:1px solid var(--dam-border);padding-top:6px}\n.dam-disclosure>summary{font-size:13px}\n.dam-disclosure[open]>summary{margin-bottom:8px}\n.dam-body{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0;max-height:420px;overflow:auto;font:inherit;font-size:12px;line-height:1.75}\n.dam-sources{margin:6px 0 12px;padding-left:18px;color:var(--dam-muted);font-size:12px;overflow-wrap:anywhere}\n.dam-sources li+li{margin-top:6px}\n.dam-source-link{color:var(--dsw-alias-link,#4176e6);text-underline-offset:3px}\n.dam-list{display:flex;flex-direction:column;gap:10px;min-width:0}\n.dam-card{min-width:0;border:1px solid var(--dam-border);border-radius:12px;padding:17px 18px;background:var(--dam-surface);overflow-wrap:anywhere}\n.dam-card h3{font-size:14px;font-weight:500}\n.dam-card .dam-row{align-items:flex-start}\n.dam-card .dam-row time{flex:none;padding-top:1px}\n.dam-card>details:first-of-type{margin-top:7px}\n.dam-issue-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;padding:12px 16px;margin-bottom:16px;border:1px solid var(--dam-border);border-radius:10px;background:var(--dam-soft);text-align:left}\nbutton.dam-issue-banner:hover{background:var(--dam-bg)}\n.dam-issue-banner .dam-count{color:var(--dam-warning);background:var(--dsw-alias-state-warn-tertiary,#fef5e7)}\n.dam-issues{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}\n.dam-issue-decision{margin-top:16px}\n.dam-issue-decision .dam-button{margin-top:10px}\n.dam-error{padding:12px 14px;border:1px solid color-mix(in srgb,var(--dam-error) 35%,transparent);border-radius:10px;margin:10px 0;color:var(--dam-error);font-size:13px}\n.dam-notice{border:1px solid var(--dam-border);border-left:3px solid var(--dam-accent);border-radius:9px;padding:13px 15px;margin:14px 0;background:var(--dam-soft);animation:dam-reveal .18s var(--dam-ease)}\n.dam-notice[data-tone=error]{border-left-color:var(--dam-error)}\n.dam-notice[data-tone=warning]{border-left-color:var(--dam-warning)}\n.dam-notice[data-tone=success]{border-left-color:var(--dam-success)}\n.dam-notice .dam-row{align-items:flex-start}\n.dam-notice .dam-row>strong{padding-top:4px;font-weight:500}\n.dam-notice>p{margin-top:5px}\n.dam-diff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:10px 0}\n.dam-diff>div{min-width:0;border:1px solid var(--dam-border);border-radius:8px;background:var(--dam-soft);padding:10px 12px}\n.dam-diff>div:last-child{border-top:2px solid var(--dam-success)}\n.dam-diff small{color:var(--dam-muted);font-size:11px}\n.dam-diff pre{max-height:280px}\n.dam-activity{max-width:860px;margin:0 auto}\n.dam-activity-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}\n.dam-job{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:3px 0}\n.dam-usage{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0 0}\n.dam-usage>div{min-width:0}\n.dam-usage dt{color:var(--dam-muted);font-size:11px;overflow-wrap:anywhere}\n.dam-usage dd{margin:3px 0 0;font-size:13px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}\n\n/* Secondary flows keep the same rhythm as native settings. */\n.dam-profile{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px;align-items:start}\n.dam-profile-content{min-width:0}\n.dam-profile-controls{display:flex;flex-direction:column;gap:18px;padding:18px;border:1px solid var(--dam-border);border-radius:12px;background:var(--dam-soft)}\n.dam-profile-sheet{border:1px solid var(--dam-border);border-radius:14px;padding:26px}\n.dam-field{display:flex;flex-direction:column;gap:6px;min-width:0;margin:3px 0}\n.dam-field>span{color:var(--dam-secondary);font-size:12px}\n.dam-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px}\n.dam-fieldset{padding:18px;border:1px solid var(--dam-border);border-radius:12px;margin:0}\n.dam-fieldset legend{padding:0 6px;font-size:13px;font-weight:500}\n.dam-fieldset .dam-section+.dam-section{margin-top:18px;padding-top:18px}\n.dam-fieldset>.dam-hint:first-child{margin-top:0!important;margin-bottom:12px}\n.dam-session-choice{display:flex;align-items:flex-start;gap:12px;cursor:pointer;transition:background var(--dam-duration) var(--dam-ease)}\n.dam-session-choice:hover{background:var(--dam-soft)}\n.dam-session-choice input{margin:4px 0 0}\n.dam-session-choice>span{flex:1;min-width:0;overflow-wrap:anywhere}\n.dam-session-choice strong{font-weight:500}\n.dam-session-choice .dam-muted{margin-top:3px}\n.dam-settings-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 0 2px;margin-top:4px;background:var(--dam-surface);border-top:1px solid var(--dam-border)}\n.dam-compose{margin-top:24px;padding:20px;border:1px solid var(--dam-border);border-radius:14px;background:var(--dam-soft);animation:dam-reveal .18s var(--dam-ease)}\n.dam-compose-title{font-size:15px;font-weight:600;margin-bottom:6px!important}\n.dam-compose .dam-row{gap:12px;margin:12px 0}\n.dam-compose .dam-row:last-child{margin-bottom:0}\n.dam-compose .dam-row select{width:auto;max-width:65%}\n.dam-compose textarea{background:var(--dam-surface)}\n.dam-compose-context{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0 12px}\n.dam-compose-context>.dam-field{flex:1;min-width:180px}\n.dam-compose-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin-top:20px;padding:15px 18px;border:1px solid var(--dam-border);border-radius:12px;background:transparent;text-align:left;color:var(--dam-secondary);transition:background var(--dam-duration) var(--dam-ease)}\n.dam-compose-trigger:hover{background:var(--dam-soft)}\n.dam-loading{display:inline-flex;align-items:center;gap:8px;color:var(--dam-muted)}\n.dam-spinner{width:15px;height:15px;border:1.5px solid var(--dam-border-strong);border-top-color:var(--dam-secondary);border-radius:50%;animation:dam-spin .8s linear infinite}\n\n/* Full-page component details. No identifiers or raw data need visual priority. */\n.dam-root .dam-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}\n.dam-shell>.dam-project-picker{display:grid;grid-template-columns:18px minmax(180px,320px) minmax(0,1fr);align-items:center;gap:12px;max-width:none;min-width:0;margin-bottom:16px}\n.dam-shell>.dam-project-picker>svg{color:var(--dam-muted)}\n.dam-shell>.dam-project-picker>.dam-project-path{margin:0;color:var(--dam-muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dam-project-bar .dam-project-meta{display:flex;align-items:center;flex:none;flex-wrap:wrap;gap:6px 8px;order:0}\n.dam-project-bar .dam-project-meta>.dam-muted{font-size:11px;line-height:1.5;white-space:nowrap}\n.dam-project-meta strong{font-weight:500;color:var(--dam-secondary);font-size:13px}\n.dam-project-bar>.dam-project-switch{min-width:0}\n.dam-state-dot{display:inline-block;flex:none;width:6px;height:6px;border-radius:50%;background:var(--dam-muted)}\n.dam-state-dot[data-enabled=true]{background:var(--dam-success)}\n.dam-category{color:var(--dam-secondary);font-size:11px}\n.dam-category[data-category=active]::before,.dam-category[data-category=stable]::before{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;margin:0 5px 1px 0;background:var(--dam-accent)}\n.dam-category[data-category=stable]::before{background:var(--dam-muted)}\n.dam-reader-footer{display:flex;flex-direction:column;gap:12px;margin-top:28px;padding-top:18px;border-top:1px solid var(--dam-border)}\n.dam-reader-footer>.dam-disclosure{margin:0;border-top:0;padding-top:0}\n.dam-conditions{margin:0 0 22px;padding:12px 15px;border-left:2px solid var(--dam-border-strong);background:var(--dam-soft);border-radius:0 8px 8px 0}\n.dam-conditions h3{margin:0 0 5px;font-size:12px;font-weight:500;color:var(--dam-muted)}\n.dam-conditions p{font-size:13px;color:var(--dam-secondary);line-height:1.7;white-space:pre-wrap}\n.dam-plain-text{white-space:pre-wrap}\n.dam-mono{font-family:var(--ds-font-family-code,monospace);font-size:11px;overflow-wrap:anywhere;color:var(--dam-muted)}\n.dam-metadata{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px 16px;margin:6px 0 0;font-size:12px}\n.dam-metadata dt{color:var(--dam-muted)}\n.dam-metadata dd{margin:0;min-width:0;overflow-wrap:anywhere}\n.dam-task-content>section{margin-top:20px}\n.dam-task-content>section h3{font-size:14px;font-weight:500;margin-bottom:8px}\n.dam-task-content ul{padding-left:20px;margin:0;line-height:1.75;overflow-wrap:anywhere}\n.dam-task-content li+li{margin-top:5px}\n.dam-timeline{display:flex;flex-direction:column;gap:0;margin-top:10px}\n.dam-change{display:grid;grid-template-columns:26px minmax(0,1fr);gap:14px;position:relative;padding-bottom:26px}\n.dam-change:last-child{padding-bottom:4px}\n.dam-change:not(:last-child)::before{content:'';position:absolute;left:12px;top:30px;bottom:4px;width:1px;background:var(--dam-border)}\n.dam-change-marker{display:grid;place-items:center;position:relative;width:26px;height:26px;border:1px solid var(--dam-border);border-radius:50%;background:var(--dam-soft);color:var(--dam-secondary)}\n.dam-change-content{min-width:0;padding-top:2px}\n.dam-change-content>.dam-row{align-items:baseline;flex-wrap:wrap;gap:5px 12px}\n.dam-change-content h3{font-size:14px;font-weight:500;overflow-wrap:anywhere}\n.dam-change-content time{color:var(--dam-muted);font-size:12px}\n.dam-change-content>.dam-disclosure{border-top:0;padding-top:2px}\n.dam-diff h4{color:var(--dam-muted);font-size:11px;font-weight:500;margin-bottom:9px}\n.dam-diff .dam-prose{font-size:12px;max-height:320px;overflow:auto}\n.dam-diagnostics>.dam-card{margin-top:12px}\n.dam-profile-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:28px;align-items:start}\n.dam-profile-main{min-width:0}\n.dam-profile-main>.dam-section-head{margin-bottom:26px}\n.dam-profile-controls h3{font-size:14px;font-weight:500}\n.dam-profile-history{margin-top:30px}\n.dam-model-row{display:grid;grid-template-columns:minmax(160px,.75fr) minmax(0,1.25fr);align-items:start;gap:20px;padding-top:18px;margin-top:18px;border-top:1px solid var(--dam-border)}\n.dam-model-row strong{font-weight:500}\n.dam-advanced>summary{font-size:13px;font-weight:500}\n.dam-advanced[open]>.dam-fieldset{margin-top:10px}\n.dam-session-choice:not(.dam-card){padding:15px 16px;border:1px solid var(--dam-border);border-radius:10px}\n.dam-session-choice>span>.dam-muted{display:block}\n.dam-back{display:inline-flex;align-items:center;gap:7px;margin-bottom:24px}\n.dam-eyebrow{font-size:12px;line-height:1.5;color:var(--dam-muted);margin-bottom:5px!important}\n.dam-skeleton{display:flex;flex-direction:column;gap:12px;padding:6px 0;animation:dam-breathe 1.6s ease-in-out infinite}\n.dam-skeleton span{height:12px;border-radius:4px;background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.04))}\n.dam-skeleton span:nth-child(2){width:92%}\n.dam-skeleton span:nth-child(3){width:66%}\n.dam-compose-dialog{width:min(600px,calc(100vw - 32px));max-height:calc(100dvh - 48px);margin:auto;padding:0;border:1px solid var(--dam-border-strong);border-radius:16px;background:var(--dam-raised);color:var(--dam-text);box-shadow:0 18px 70px rgba(0,0,0,.18);overflow:auto}\n.dam-compose-dialog::backdrop{background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.24))}\n.dam-compose-dialog[open]{animation:dam-reveal .18s var(--dam-ease)}\n.dam-compose-dialog>.dam-compose{margin:0;padding:24px;border:0;border-radius:0;background:var(--dam-raised);animation:none}\n.dam-compose-dialog .dam-compose>.dam-row:first-child{align-items:flex-start;margin:0 0 22px}\n.dam-compose-dialog h2{font-size:18px;font-weight:600;line-height:1.5}\n.dam-compose-dialog textarea{margin-bottom:16px;min-height:135px}\n.dam-compose-dialog .dam-field+.dam-field{margin-top:12px}\n.dam-compose-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:24px;padding-top:18px;border-top:1px solid var(--dam-border)}\n@keyframes dam-breathe{0%,100%{opacity:.6}50%{opacity:1}}\n@keyframes dam-reveal{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}\n@keyframes dam-spin{to{transform:rotate(360deg)}}\n\n/* Container width reflects the host sidebar, not just the browser window. */\n@container(max-width:820px){\n  .dam-library-toolbar{flex-wrap:wrap;gap:12px}\n  .dam-search{max-width:none}\n  .dam-reader{padding:22px}\n  .dam-profile,.dam-profile-layout{grid-template-columns:1fr}\n  .dam-profile-controls{flex-direction:row;flex-wrap:wrap}\n  .dam-profile-controls>*{flex:1;min-width:180px}\n  .dam-profile-controls>h3,.dam-profile-controls>.dam-hint{flex-basis:100%}\n  .dam-model-row{grid-template-columns:1fr;gap:12px}\n}\n@container(max-width:680px){\n  .dam-project-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px 12px}\n  .dam-project-bar>.dam-project-picker{grid-column:1;grid-row:1;min-width:0}\n  .dam-project-bar>.dam-project-switch{grid-column:2;grid-row:1;margin:0;width:auto}\n  .dam-project-bar>.dam-project-meta{grid-column:1 / -1;grid-row:2;min-width:0}\n  .dam-project-bar .dam-project-meta>.dam-muted{white-space:normal}\n  .dam-page-header{gap:16px}\n  .dam-header-actions{justify-content:flex-end}\n  .dam-tabs{gap:20px}\n  .dam-navigation{flex-wrap:wrap;gap:0}\n  .dam-page-tools{padding-bottom:10px}\n  .dam-library-toolbar{align-items:stretch}\n  .dam-library-toolbar .dam-search{flex-basis:100%}\n  .dam-memory-layout{grid-template-columns:1fr;min-height:320px}\n  .dam-memory-list{border-right:0}\n  .dam-reader{border-top:1px solid var(--dam-border)}\n  .dam-memory-layout[data-has-selection=true]>.dam-memory-list{display:none}\n  .dam-memory-layout[data-has-selection=true]>.dam-reader{border-top:0}\n  .dam-memory-layout[data-has-selection=false]>.dam-reader{display:none}\n  .dam-reader-back{display:inline-flex;margin-bottom:16px}\n  .dam-reader-head{gap:10px}\n  .dam-reader-head h2,.dam-reader-head h3{font-size:18px}\n  .dam-diff{grid-template-columns:1fr}\n  .dam-usage{grid-template-columns:repeat(2,minmax(0,1fr))}\n  .dam-card .dam-row{flex-wrap:wrap;gap:5px 12px}\n  .dam-activity-toolbar{flex-direction:column;gap:12px}\n  .dam-shell>.dam-project-picker{grid-template-columns:18px minmax(0,1fr)}\n  .dam-shell>.dam-project-picker>.dam-project-path{grid-column:2;margin-top:-6px}\n  .dam-section-head{flex-wrap:wrap}\n}\n@container(max-width:460px){\n  .dam-page-header{flex-direction:column;margin-bottom:20px}\n  .dam-header-actions{justify-content:flex-start}\n  .dam-project-bar{padding:14px}\n  .dam-project-picker{min-width:0;max-width:none;flex-basis:100%}\n  .dam-project-switch{margin-left:0;width:100%}\n  .dam-project-bar>.dam-project-switch{margin-left:auto;width:auto}\n  .dam-project-switch .dam-hint{max-width:none}\n  .dam-tabs{width:100%;gap:18px}\n  .dam-tabs button{font-size:13px}\n  .dam-filters{gap:2px}\n  .dam-filters button{padding:5px 8px}\n  .dam-fields{grid-template-columns:1fr}\n  .dam-fieldset,.dam-card,.dam-compose{padding:15px}\n  .dam-profile-sheet{padding:20px}\n  .dam-reader{padding:18px}\n  .dam-reader-head{flex-wrap:wrap}\n  .dam-compose .dam-row{flex-wrap:wrap}\n  .dam-compose .dam-row select{width:100%;max-width:none}\n  .dam-issue-banner{gap:10px}\n  .dam-compose-dialog>.dam-compose{padding:20px}\n  .dam-change{gap:10px}\n}\n@media(max-width:600px){.dam-page{--dam-page-gutter:16px;--dam-page-top:24px;padding-bottom:32px}}\n@media(prefers-reduced-motion:reduce){\n  .dam-root *,.dam-root *::before,.dam-root *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}\n}\n\n\n.dam-memory-layout[data-empty=true]{grid-template-columns:1fr;min-height:300px}\n.dam-memory-layout[data-empty=true]>.dam-memory-list{border-right:0}\n.dam-memory-layout[data-empty=true]>.dam-reader{display:none}\n\n.dam-scope-mode{display:flex;align-items:center;gap:12px;margin:4px 0 12px}.dam-retained-note{color:var(--color-text-secondary);font-size:13px;line-height:1.6;margin:0 0 16px}\n\n/* Workspace-first memory: reading and conversation share one stable surface. */\n.dam-workflow-page{overflow-anchor:none;--dam-page-gutter:clamp(20px,3vw,44px);--dam-page-top:28px}\n.dam-workflow-page .dam-shell{max-width:1420px}\n.dam-workflow-page .dam-link{color:var(--dam-secondary)}\n.dam-workflow-page .dam-button.subtle{background:transparent;border-color:transparent;color:var(--dam-secondary);padding-left:7px;padding-right:7px;font-weight:400}\n.dam-workflow-page .dam-button.subtle:hover{color:var(--dam-text);background:var(--dam-bg)}\n.dam-home-workspaces{margin-top:42px}\n.dam-home-workspaces>.dam-section-head{margin-bottom:16px}\n.dam-home-workspaces>.dam-section-head h2{font-size:15px}\n.dam-workspace-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:16px}\n.dam-workspace-card{text-align:left;min-height:220px;padding:24px;border:1px solid var(--dam-border);background:var(--dam-raised);border-radius:14px!important;display:flex;flex-direction:column;align-items:flex-start;gap:13px;transition:background .18s var(--dam-ease),border-color .18s var(--dam-ease),transform .18s var(--dam-ease)}\n.dam-workspace-card:hover:not(:disabled){border-color:var(--dam-border-strong);background:var(--dam-soft);transform:translateY(-2px)}\n.dam-workspace-card h3{font-size:16px;font-weight:550;line-height:1.5;overflow-wrap:anywhere;max-width:100%}\n.dam-workspace-card p{color:var(--dam-muted);font-size:13px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.dam-workspace-card-icon{display:flex;align-items:center;justify-content:center;width:42px;height:42px;background:var(--dam-soft);border:1px solid var(--dam-border);border-radius:11px;flex:none;color:var(--dam-secondary)}\n.dam-workspace-card-open{margin-top:auto;font-size:12px;color:var(--dam-secondary)}\n.dam-global-card{display:flex;align-items:center;gap:17px;width:100%;margin-top:24px;padding:20px 24px;border:1px solid var(--dam-border);border-radius:13px!important;background:transparent;text-align:left;transition:background .18s var(--dam-ease)}\n.dam-global-card:hover{background:var(--dam-soft)}\n.dam-global-card strong{display:block;font-weight:550;font-size:15px;margin-bottom:4px}\n.dam-global-card .dam-muted{display:block}\n.dam-global-open{margin-left:auto;color:var(--dam-secondary)}\n.dam-workspace-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px;padding-inline-start:max(0px,calc(var(--dsh-frame-leading-clearance,0px) - var(--dam-page-gutter)))}\n.dam-workspace-header h1{font-size:24px;font-weight:600;letter-spacing:-.02em;line-height:1.4;overflow-wrap:anywhere}\n.dam-workspace-title{display:flex;align-items:center;gap:10px;min-width:0}\n.dam-workspace-title>svg{color:var(--dam-secondary);flex:none}\n.dam-workspace-header>.dam-button{margin-top:8px;flex:none}\n.dam-workspace-header .dam-breadcrumb{margin:0 0 13px -7px;font-size:12px;min-height:28px}\n.dam-workspace-split{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.85fr);gap:0;min-height:600px;align-items:start;border:1px solid var(--dam-border);border-radius:15px;overflow:hidden;background:var(--dam-raised)}\n.dam-memory-pane{min-width:0;padding:30px;overflow:auto;max-height:calc(100dvh - 225px);min-height:600px;scrollbar-gutter:stable}\n.dam-manager{position:sticky;top:0;min-width:0;height:max(600px,calc(100dvh - 225px));max-height:1000px;display:flex;flex-direction:column;border-left:1px solid var(--dam-border);background:var(--dam-surface)}\n.dam-manager-header{display:flex;gap:10px;align-items:flex-start;padding:22px 22px 18px;border-bottom:1px solid var(--dam-border)}\n.dam-manager-header>svg{color:var(--dam-secondary);margin-top:2px;flex:none}\n.dam-manager-header h2{font-size:14px;font-weight:550;line-height:1.5}\n.dam-manager-header p{font-size:12px;color:var(--dam-muted);margin-top:3px;line-height:1.5}\n.dam-chat-log{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:24px 20px;scrollbar-gutter:stable}\n.dam-chat-welcome{display:flex;align-items:center;flex-direction:column;text-align:center;gap:12px;padding:52px 15px 30px;color:var(--dam-muted)}\n.dam-chat-welcome h3{font-size:16px;color:var(--dam-text);font-weight:500}\n.dam-chat-welcome p{max-width:280px;line-height:1.8;font-size:13px}\n.dam-chat-suggestions{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin-top:12px;max-width:100%}\n.dam-chat-suggestions .dam-button{font-size:12px;white-space:normal;text-align:left;align-self:stretch;font-weight:400;color:var(--dam-secondary);justify-content:flex-start;background:transparent}\n.dam-chat-message{margin-bottom:24px;font-size:13px;overflow-wrap:anywhere}\n.dam-chat-message[data-role=user]{margin-left:22px;padding:12px 15px;border-radius:14px 14px 4px 14px;background:var(--dam-soft);border:1px solid var(--dam-border)}\n.dam-chat-message[data-role=assistant]{margin-right:8px;padding:0 2px}\n.dam-chat-message .dam-prose{font-size:13px;line-height:1.8}\n.dam-chat-message .dam-prose h1,.dam-chat-message .dam-prose h2,.dam-chat-message .dam-prose h3{font-size:14px}\n.dam-chat-progress{display:flex;align-items:center;gap:9px;color:var(--dam-muted);font-size:12px;padding:6px 2px 18px}\n.dam-chat-composer{margin:0 16px 16px;padding:12px;border:1px solid var(--dam-border-strong);border-radius:13px;background:var(--dam-raised);box-shadow:0 2px 8px rgba(0,0,0,.025)}\n.dam-chat-composer:focus-within{border-color:var(--dam-secondary)}\n.dam-chat-scope{display:flex;align-items:center;gap:6px;color:var(--dam-muted);font-size:11px;line-height:1.5;padding:0 4px 8px;min-width:0}\n.dam-chat-scope>svg{flex:none}\n.dam-chat-scope>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.dam-root .dam-chat-composer textarea{border:0;background:transparent;padding:4px;min-height:76px;max-height:180px;font-size:13px;resize:vertical;border-radius:0;outline:none;box-shadow:none}\n.dam-chat-send-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}\n.dam-chat-send-row>.dam-muted{font-size:10px;max-width:210px}\n.dam-chat-send-row>.dam-button{min-height:31px;padding:4px 11px;font-size:12px;flex:none}\n.dam-chat-confirm{padding:16px;border:1px solid var(--dam-border-strong);border-radius:12px;background:var(--dam-soft);margin:16px 0}\n.dam-chat-confirm p{margin:8px 0 12px;color:var(--dam-secondary);font-size:12px;white-space:pre-wrap}\n.dam-chat-log .dam-error{font-size:12px;overflow-wrap:anywhere}\n.dam-chat-log .dam-error .dam-button{margin-top:8px}\n.dam-overview{display:flex;flex-direction:column;gap:22px;min-width:0}\n.dam-overview-heading h2,.dam-overview>h2{font-size:23px;line-height:1.4;font-weight:550;letter-spacing:-.02em}\n.dam-overview-heading>.dam-muted{margin-top:8px}\n.dam-overview-summary{font-size:14px;line-height:1.9;color:var(--dam-secondary)}\n.dam-overview-summary .dam-prose{font-size:14px;line-height:1.9;color:var(--dam-secondary)}\n.dam-overview-summary .dam-prose h1,.dam-overview-summary .dam-prose h2,.dam-overview-summary .dam-prose h3{color:var(--dam-text);font-size:16px}\n.dam-overview-empty{font-size:14px;line-height:1.9;color:var(--dam-secondary);padding:6px 0}\n.dam-topics{border-top:1px solid var(--dam-border);padding-top:22px}\n.dam-topics>.dam-row{margin-bottom:16px}\n.dam-topics h3{font-size:14px;font-weight:550}\n.dam-topic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px}\n.dam-topic-card{padding:18px;text-align:left;border:1px solid var(--dam-border);border-radius:12px!important;background:transparent;min-width:0;transition:background .18s var(--dam-ease),border-color .18s var(--dam-ease)}\n.dam-topic-card:hover{background:var(--dam-soft);border-color:var(--dam-border-strong)}\n.dam-topic-card>.dam-row{margin-bottom:14px;color:var(--dam-muted)}\n.dam-topic-card h3{line-height:1.5;overflow-wrap:anywhere;margin-bottom:7px}\n.dam-topic-card p{font-size:12px;line-height:1.7;color:var(--dam-muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}\n.dam-topic-open{display:block;margin-top:14px;color:var(--dam-secondary);font-size:11px}\n.dam-empty-topics{border:1px dashed var(--dam-border-strong);border-radius:12px;padding:24px;display:flex;align-items:center;gap:14px;color:var(--dam-muted);font-size:13px}\n.dam-overview-back{align-self:flex-start;font-size:12px}\n.dam-topic-records{min-width:0}\n.dam-topic-records .dam-library-toolbar{margin-bottom:15px}\n.dam-topic-records .dam-search{max-width:none}\n.dam-record{border:1px solid var(--dam-border);border-radius:11px;margin-bottom:10px;overflow:hidden}\n.dam-record-head{display:flex;align-items:center;justify-content:space-between;text-align:left;gap:14px;width:100%;padding:16px;border:0;border-radius:0!important;background:transparent}\n.dam-record-head:hover{background:var(--dam-soft)}\n.dam-record-head strong{font-size:13px;display:block;font-weight:500;line-height:1.6;overflow-wrap:anywhere}\n.dam-record-head .dam-muted{display:block;margin-top:4px;font-size:12px}\n.dam-record-chevron{color:var(--dam-muted);font-size:23px;transition:transform .18s var(--dam-ease);flex:none}\n.dam-record[data-expanded=true] .dam-record-chevron{transform:rotate(90deg)}\n.dam-record-body{padding:0 18px 18px;border-top:1px solid var(--dam-border);animation:dam-reveal .18s var(--dam-ease)}\n.dam-record-body>.dam-conditions{margin-top:16px}\n.dam-record-body .dam-prose{font-size:13px;line-height:1.8}\n.dam-record-footer{display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin:20px 0 12px}\n.dam-record-footer .dam-button{font-size:12px}\n.dam-record-footer>.dam-disclosure{margin:0;padding:0;border:0}\n.dam-record .dam-loading{min-height:90px}\n.dam-issues-inline{border:1px solid var(--dam-border);border-radius:12px;padding:16px;background:var(--dam-soft)}\n.dam-issues-inline>h3{font-size:13px;font-weight:550;margin-bottom:8px}\n.dam-issue-row{display:flex;align-items:center;gap:10px;width:100%;border:0;border-radius:7px;background:transparent;text-align:left;padding:10px 4px;font-size:13px}\n.dam-issue-row>svg{flex:none;color:var(--dam-secondary)}\n.dam-issue-row>span:last-child{margin-left:auto;color:var(--dam-muted);font-size:20px}\n.dam-issue-row:hover{background:var(--dam-bg)}\n.dam-issue-detail{display:flex;flex-direction:column;gap:18px}\n.dam-issue-detail h2{font-size:20px;line-height:1.5;font-weight:550}\n.dam-memory-activity{max-width:none}\n.dam-memory-activity>.dam-section-head{gap:16px;margin-bottom:20px}\n.dam-memory-activity .dam-section-head>.dam-button{font-size:12px;flex:none}\n.dam-activity-origin{display:inline-block;color:var(--dam-muted);font-size:11px;margin-left:30px;margin-bottom:8px}\n.dam-memory-activity .dam-timeline>div{margin-bottom:22px}\n.dam-memory-activity .dam-timeline>div>.dam-button{margin-left:30px;font-size:12px}\n.dam-memory-activity .dam-change h3{font-size:14px}\n.dam-memory-activity .dam-diff{grid-template-columns:1fr}\n.dam-inline-status{padding:11px 13px;border-radius:8px;background:var(--dam-soft);font-size:12px;color:var(--dam-secondary);margin-bottom:20px!important}\n.dam-settings-layout{display:grid;grid-template-columns:200px minmax(0,1fr);gap:42px;margin-top:28px;max-width:1150px}\n.dam-settings-nav{display:flex;flex-direction:column;gap:5px;align-items:stretch}\n.dam-settings-nav .dam-button{border:0;background:transparent;justify-content:flex-start;align-self:stretch;text-align:left;font-weight:400;padding:10px 13px;color:var(--dam-secondary)}\n.dam-settings-nav .dam-button[aria-current=page]{background:var(--dam-soft);color:var(--dam-text);font-weight:500}\n.dam-settings-main{min-width:0}\n.dam-settings-main>.dam-section,.dam-settings-main .dam-secondary-panel{max-width:none;margin:0}\n.dam-settings-main .dam-section-head h2{font-size:20px}\n.dam-settings-main .dam-model-row{grid-template-columns:minmax(120px,.8fr) minmax(0,1.2fr)}\n.dam-settings-subnav{display:flex;gap:8px;margin:15px 0}\n.dam-settings-control-list{margin-top:16px}\n.dam-setting-row{display:flex;align-items:center;justify-content:space-between;gap:30px;padding:20px 0;border-bottom:1px solid var(--dam-border)}\n.dam-setting-row strong{font-size:13px;font-weight:500}\n.dam-setting-row .dam-hint{display:block;max-width:520px;margin-top:5px}\n.dam-setting-row>input[role=switch]{appearance:none;width:34px;height:20px;border-radius:12px;background:var(--dam-border-strong);border:0;position:relative;cursor:pointer;transition:background .18s var(--dam-ease)}\n.dam-setting-row>input[role=switch]::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--dam-raised);transition:transform .18s var(--dam-ease)}\n.dam-setting-row>input[role=switch]:checked{background:var(--dam-text)}\n.dam-setting-row>input[role=switch]:checked::after{transform:translateX(14px);background:var(--dam-surface)}\n.dam-settings-archive-section{margin-top:18px}\n.dam-settings-archive-section>h3{font-size:15px;font-weight:550;margin-bottom:10px}\n.dam-settings-archive-section>.dam-field{margin:20px 0}\n.dam-archive-row{width:100%;display:flex;align-items:center;gap:13px;text-align:left;padding:16px;border:1px solid var(--dam-border);background:transparent;margin:10px 0;border-radius:10px!important}\n.dam-archive-row:hover{background:var(--dam-soft)}\n.dam-archive-row>span:last-child{margin-left:auto;color:var(--dam-muted);font-size:20px}\n.dam-archive-row strong,.dam-archive-row .dam-muted{display:block}\n.dam-archive-row strong{font-weight:500;font-size:13px;margin-bottom:4px}\n.dam-mobile-panes{display:none}\n@container(max-width:1050px){\n .dam-workspace-split{grid-template-columns:minmax(0,1fr) minmax(300px,.9fr)}\n .dam-memory-pane{padding:24px}\n .dam-topic-grid{grid-template-columns:1fr}\n .dam-settings-layout{grid-template-columns:175px minmax(0,1fr);gap:25px}\n .dam-settings-main .dam-model-row{grid-template-columns:1fr;gap:12px}\n}\n@container(max-width:760px){\n .dam-workspace-split{display:block;min-height:0}\n .dam-memory-pane{max-height:none;min-height:500px;padding:24px}\n .dam-manager{position:relative;border-left:0;height:calc(100dvh - 235px);min-height:500px;max-height:800px}\n .dam-mobile-panes{display:flex;gap:8px;margin:-9px 0 16px}\n .dam-mobile-panes .dam-button[aria-pressed=true]{background:var(--dam-soft);border-color:var(--dam-border-strong)}\n .dam-workspace-split[data-mobile-pane=memory]>.dam-manager{display:none}\n .dam-workspace-split[data-mobile-pane=chat]>.dam-memory-pane{display:none}\n .dam-settings-layout{grid-template-columns:1fr;gap:24px}\n .dam-settings-nav{flex-direction:row;flex-wrap:wrap;gap:3px;border-bottom:1px solid var(--dam-border);padding-bottom:14px}\n .dam-settings-nav .dam-button{font-size:12px;padding:7px 10px}\n .dam-topic-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))}\n}\n@container(max-width:460px){\n .dam-home-workspaces{margin-top:25px}\n .dam-workspace-card{min-height:190px;padding:20px}\n .dam-workspace-header h1{font-size:20px}\n .dam-workspace-header{gap:10px}\n .dam-workspace-header>.dam-button{font-size:12px;padding:6px 10px}\n .dam-memory-pane{padding:20px}\n .dam-overview-heading h2{font-size:21px}\n .dam-manager-header{padding:20px}\n .dam-chat-log{padding:20px 15px}\n .dam-setting-row{gap:18px}\n .dam-memory-activity>.dam-section-head{flex-wrap:wrap}\n .dam-global-card{padding:18px}\n}\n\n/* Historical source selection separates selectable history from read-only coverage. */\n.dam-history-picker{display:flex;flex-direction:column;gap:20px;min-width:0}\n.dam-history-picker>.dam-search{max-width:none}\n.dam-history-group{display:flex;flex-direction:column;gap:12px}\n.dam-history-group h4{font-size:13px;font-weight:500}\n.dam-history-group>.dam-hint{margin-top:-6px!important}\n.dam-history-covered{border-top:1px solid var(--dam-border);padding-top:20px}\n.dam-covered-session{display:flex;align-items:flex-start;gap:12px;padding:15px 16px;border:1px solid var(--dam-border);border-radius:10px;background:var(--dam-soft)}\n.dam-covered-session>svg{flex:none;color:var(--dam-secondary);margin-top:2px}\n.dam-covered-session>span:not(.dam-badge){flex:1;min-width:0;overflow-wrap:anywhere}\n.dam-covered-session strong{font-weight:500}\n.dam-covered-session .dam-muted{display:block;margin-top:3px}\n.dam-covered-session>.dam-badge{flex:none}\n";var __AutoMemoryClient = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/client.js
  var client_exports = {};
  __export(client_exports, {
    Page: () => Page,
    Panel: () => WorkspacePage,
    apiRequest: () => apiRequest,
    apply: () => apply,
    captureMemoryNavigation: () => captureMemoryNavigation,
    catalogRequest: () => catalogRequest,
    createAvailabilityMonitor: () => createAvailabilityMonitor,
    createManagerChannel: () => createManagerChannel,
    filterMemories: () => filterMemories,
    historySessionBlank: () => historySessionBlank,
    historySessionGroups: () => historySessionGroups,
    includeHistorySelection: () => includeHistorySelection,
    inject: () => inject,
    jobPresentation: () => jobPresentation,
    managerErrorMessage: () => managerErrorMessage,
    managerRetryLabel: () => managerRetryLabel,
    migrateLegacyTabs: () => migrateLegacyTabs,
    navigateMemoryPage: () => navigateMemoryPage,
    normaliseSettings: () => normaliseSettings,
    receiptPresentation: () => receiptPresentation,
    usagePresentation: () => usagePresentation,
    visibleDreamActivity: () => visibleDreamActivity,
    visibleMemoryActivity: () => visibleMemoryActivity,
    workspaceProjects: () => workspaceProjects
  });

  // src/i18n.js
  var zh = {
    refreshStatus: "\u5237\u65B0\u72B6\u6001",
    resendRequest: "\u91CD\u65B0\u53D1\u9001",
    reviewResult: "\u6838\u5BF9\u7ED3\u679C",
    failureDetails: "\u67E5\u770B\u5931\u8D25\u539F\u56E0",
    failureCode: "\u9519\u8BEF\u4EE3\u7801",
    failureStage: "\u53D1\u751F\u9636\u6BB5",
    managerStep: "\u7B2C {step} \u6B65",
    managerModelCall: "\u6A21\u578B\u8C03\u7528",
    managerStage_prepare: "\u51C6\u5907\u4E0A\u4E0B\u6587",
    managerStage_budget: "\u68C0\u67E5\u7528\u91CF",
    managerStage_model: "\u6A21\u578B\u56DE\u590D",
    managerStage_tool: "\u8BFB\u53D6\u6216\u4FEE\u6539\u8BB0\u5FC6",
    managerStage_confirmation: "\u7B49\u5F85\u6E05\u9664\u786E\u8BA4",
    managerStage_completed: "\u5DF2\u5B8C\u6210",
    managerStage_cancelled: "\u8BF7\u6C42\u5DF2\u505C\u6B62",
    "managerStage_step-limit": "\u8FBE\u5230\u6B65\u9AA4\u4E0A\u9650",
    deliveryUnconfirmed: "\u8BF7\u6C42\u662F\u5426\u9001\u8FBE\u5C1A\u672A\u786E\u8BA4\u3002\u8BF7\u5148\u5237\u65B0\u72B6\u6001\uFF0C\u6216\u4F7F\u7528\u76F8\u540C\u5185\u5BB9\u91CD\u65B0\u53D1\u9001\uFF1B\u4E0D\u4F1A\u91CD\u590D\u63D0\u4EA4\u540C\u4E00\u8BF7\u6C42\u3002",
    managerFailure: "\u8FD9\u6B21\u8BF7\u6C42\u672A\u5B8C\u6210\u3002\u53EF\u67E5\u770B\u539F\u56E0\uFF0C\u5E76\u6838\u5BF9\u5F53\u524D\u7ED3\u679C\u3002",
    managerAuthError: "\u6A21\u578B\u51ED\u636E\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u8BBE\u7F6E\u3002",
    managerRateLimitError: "\u6A21\u578B\u670D\u52A1\u6682\u65F6\u9650\u6D41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u65B0\u53D1\u9001\u3002",
    managerBudgetError: "\u672C\u65E5\u6A21\u578B\u7528\u91CF\u5DF2\u8FBE\u5230\u8BBE\u7F6E\u4E0A\u9650\u3002",
    managerContextError: "\u8FD9\u6BB5\u7BA1\u7406\u5BF9\u8BDD\u5DF2\u8FBE\u5230\u4E0A\u4E0B\u6587\u4E0A\u9650\uFF0C\u8BF7\u91CD\u65B0\u8FDB\u5165\u5DE5\u4F5C\u533A\u5F00\u59CB\u65B0\u5BF9\u8BDD\u3002",
    managerTimeoutError: "\u672C\u6B21\u5904\u7406\u8D85\u65F6\uFF0C\u8BF7\u5148\u6838\u5BF9\u7ED3\u679C\u3002",
    managerStepError: "\u672C\u6B21\u5904\u7406\u8FBE\u5230\u6B65\u9AA4\u4E0A\u9650\uFF0C\u8BF7\u5148\u6838\u5BF9\u7ED3\u679C\u3002",
    managerWritesCommitted: "\u5DF2\u6709\u4FEE\u6539\u4FDD\u5B58\u6210\u529F\u3002\u201C\u6838\u5BF9\u7ED3\u679C\u201D\u53EA\u68C0\u67E5\u5F53\u524D\u8BB0\u5FC6\uFF0C\u4E0D\u91CD\u590D\u4FEE\u6539\u3002",
    managerWritesUncertain: "\u67D0\u9879\u4FEE\u6539\u7684\u8FD4\u56DE\u7ED3\u679C\u4E0D\u786E\u5B9A\u3002\u201C\u6838\u5BF9\u7ED3\u679C\u201D\u4F1A\u53EA\u8BFB\u68C0\u67E5\u5F53\u524D\u72B6\u6001\uFF0C\u907F\u514D\u91CD\u590D\u63D0\u4EA4\u3002",
    historyPausedHint: "\u8BE5\u5DE5\u4F5C\u533A\u7684\u81EA\u52A8\u8BB0\u5FC6\u5DF2\u5173\u95ED\uFF0C\u53EF\u5728\u5DE5\u4F5C\u533A\u8BBE\u7F6E\u4E2D\u5F00\u542F\u540E\u7EB3\u5165\u5386\u53F2\u4F1A\u8BDD\u3002",
    historySelectable: "\u53EF\u7EB3\u5165\u7684\u5386\u53F2\u4F1A\u8BDD",
    historyCovered: "\u5DF2\u5728\u8BB0\u5FC6\u7BA1\u7406\u8303\u56F4",
    historyCoveredHint: "\u8FD9\u4E9B\u4F1A\u8BDD\u5DF2\u7EB3\u5165\uFF0C\u65E0\u9700\u91CD\u590D\u9009\u62E9\u3002\u8FD9\u8868\u793A\u5B83\u4EEC\u5DF2\u5728\u7BA1\u7406\u8303\u56F4\u5185\uFF0C\u4E0D\u4EE3\u8868\u6BCF\u53E5\u8BDD\u90FD\u5DF2\u4FDD\u5B58\u4E3A\u8BB0\u5FC6\u3002",
    noMatchingSessions: "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD",
    backToArchive: "\u8FD4\u56DE\u5F52\u6863\u4E0E\u5386\u53F2",
    backToSettings: "\u8FD4\u56DE\u8BBE\u7F6E",
    backToWorkspaceMemory: "\u8FD4\u56DE\u5DE5\u4F5C\u533A\u8BB0\u5FC6",
    backToProfile: "\u8FD4\u56DE\u5168\u5C40\u8D44\u6599",
    topicsOrganized: "\u5DF2\u91CD\u65B0\u7EC4\u7EC7\u4E3B\u9898\uFF08{count} \u4E2A\uFF09",
    issueResolved: "\u4E89\u8BAE\u5DF2\u89E3\u51B3",
    defaultWorkspace: "\u9ED8\u8BA4\u5DE5\u4F5C\u533A",
    homeSubtitle: "\u9009\u62E9\u4E00\u4E2A\u5DE5\u4F5C\u533A\uFF0C\u4E86\u89E3\u5E76\u7BA1\u7406\u5B83\u8BB0\u4F4F\u7684\u4E8B\u60C5\u3002",
    workspaces: "\u5DE5\u4F5C\u533A",
    openWorkspaceMemory: "\u6253\u5F00 {name} \u7684\u8BB0\u5FC6",
    workspaceCardHint: "\u9879\u76EE\u603B\u7ED3\u3001\u4E3B\u9898\u4E0E\u91CD\u8981\u7EA6\u5B9A",
    openMemory: "\u67E5\u770B\u8BB0\u5FC6",
    noWorkspaces: "\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u533A",
    noWorkspacesHint: "\u5728\u5DE6\u4FA7\u6DFB\u52A0\u5DE5\u4F5C\u533A\u540E\uFF0C\u53EF\u5728\u8FD9\u91CC\u67E5\u770B\u5B83\u7684\u8BB0\u5FC6\u3002",
    backToWorkspaces: "\u6240\u6709\u5DE5\u4F5C\u533A",
    currentMemory: "\u5F53\u524D\u8BB0\u5FC6",
    memoryActivity: "\u8BB0\u5FC6\u52A8\u6001",
    memoryActivityIntro: "\u65E5\u5E38\u8BB0\u5F55\u3001\u4F60\u7684\u4FEE\u6539\u4E0E\u540E\u53F0\u6574\u7406\uFF0C\u90FD\u5728\u8FD9\u91CC\u7559\u4E0B\u5B9E\u9645\u53D8\u66F4\u3002",
    emptyMemoryActivity: "\u8FD8\u6CA1\u6709\u8BB0\u5FC6\u53D8\u66F4",
    emptyMemoryActivityHint: "\u8BB0\u5FC6\u4FDD\u5B58\u6216\u66F4\u65B0\u540E\uFF0C\u4F1A\u5728\u8FD9\u91CC\u663E\u793A\u53D8\u5316\u3002",
    ordinaryUpdate: "\u65E5\u5E38\u8BB0\u5F55",
    stageUpdate: "\u9636\u6BB5\u6574\u7406",
    requestedUpdate: "\u4E3B\u52A8\u4FEE\u6539",
    automaticUpdate: "\u540E\u53F0\u6574\u7406",
    askAboutChange: "\u8BE2\u95EE\u8FD9\u6B21\u53D8\u66F4",
    recentConsolidations: "\u6574\u7406\u6267\u884C\u8BB0\u5F55",
    consolidationFailed: "\u8FD9\u6B21\u6574\u7406\u672A\u5B8C\u6210\uFF0C\u5DF2\u6709\u8BB0\u5FC6\u4FDD\u7559\u3002\u53EF\u5C55\u5F00\u8BE6\u60C5\u67E5\u770B\u539F\u56E0\u3002",
    waitingModel: "\u7B49\u5F85\u6A21\u578B\u670D\u52A1",
    modelWaitHint: "\u5F53\u524D\u8FD0\u884C\u7AEF\u672A\u914D\u7F6E\u6240\u9009\u6A21\u578B\uFF0C\u53EF\u7531\u5DF2\u914D\u7F6E\u8BE5\u6A21\u578B\u7684\u684C\u9762\u7AEF\u6216 Web \u7EE7\u7EED\u5904\u7406\u3002\u4EFB\u52A1\u4E0D\u4F1A\u81EA\u52A8\u6539\u7528\u5176\u4ED6\u6A21\u578B\u3002",
    projectOverview: "\u9879\u76EE\u603B\u89C8",
    overviewTitle: "\u8FD9\u4E2A\u9879\u76EE\u8BB0\u4F4F\u4E86\u4EC0\u4E48",
    overviewEmpty: "\u9879\u76EE\u7684\u91CD\u8981\u7EA6\u5B9A\u548C\u8FDB\u5C55\u4F1A\u5728\u8FD9\u91CC\u79EF\u7D2F\u3002\u4E5F\u53EF\u4EE5\u76F4\u63A5\u5728\u53F3\u4FA7\u544A\u8BC9\u6211\u9700\u8981\u8BB0\u4F4F\u7684\u5185\u5BB9\u3002",
    overviewPending: "\u5DF2\u6709\u8BB0\u5FC6\u53EF\u5728\u201C\u5168\u90E8\u8BB0\u5FC6\u201D\u4E2D\u67E5\u770B\u3002",
    overviewStale: "\u8BB0\u5FC6\u5DF2\u66F4\u65B0\uFF0C\u603B\u7ED3\u6B63\u5728\u540C\u6B65\u3002",
    topics: "\u6309\u4E3B\u9898\u9605\u8BFB",
    topicMemory: "\u4E3B\u9898\u8BB0\u5FC6",
    viewTopic: "\u8FDB\u5165\u4E3B\u9898",
    topicRead: "\u67E5\u770B\u8FD9\u4E2A\u4E3B\u9898\u4E0B\u7684\u8BB0\u5FC6\u3002",
    topicEmpty: "\u6709\u4E86\u8BB0\u5FC6\u4E4B\u540E\uFF0C\u7CFB\u7EDF\u4F1A\u6309\u4E3B\u9898\u7EC4\u7EC7\uFF0C\u4F60\u4E5F\u53EF\u4EE5\u901A\u8FC7\u5BF9\u8BDD\u8C03\u6574\u3002",
    emptyHistory: "\u8FD8\u6CA1\u6709\u5386\u53F2\u8BB0\u5FC6",
    discussMemory: "\u8BA8\u8BBA\u8FD9\u6761\u8BB0\u5FC6",
    needsDecision: "\u9700\u8981\u4F60\u51B3\u5B9A",
    issueChatHint: "\u5728\u53F3\u4FA7\u8BF4\u660E\u4F60\u7684\u5224\u65AD\uFF0C\u6216\u5148\u8BE2\u95EE\u4E89\u8BAE\u7684\u6765\u7531\u3002\u786E\u5B9A\u540E\u4F1A\u66F4\u65B0\u76F8\u5173\u8BB0\u5FC6\u3002",
    discussIssue: "\u8BA8\u8BBA\u5E76\u89E3\u51B3",
    wholeProject: "\u6574\u4E2A\u9879\u76EE",
    managerTitle: "\u8BB0\u5FC6\u5BF9\u8BDD",
    managerSubtitle: "\u89E3\u91CA\u3001\u8865\u5145\u6216\u66F4\u6B63\u5F53\u524D\u8BB0\u5FC6",
    managerMessages: "\u8BB0\u5FC6\u7BA1\u7406\u5BF9\u8BDD",
    managerWelcome: "\u8FD9\u91CC\u7684\u8BB0\u5FC6\uFF0C\u53EF\u4EE5\u76F4\u63A5\u804A",
    managerWelcomeProject: "\u95EE\u95EE\u9879\u76EE\u8BB0\u4F4F\u4E86\u4EC0\u4E48\uFF0C\u6216\u8005\u544A\u8BC9\u6211\u54EA\u91CC\u9700\u8981\u8865\u5145\u548C\u8C03\u6574\u3002",
    managerWelcomeUser: "\u8FD9\u91CC\u7BA1\u7406\u8DE8\u9879\u76EE\u7684\u4E2A\u4EBA\u8D44\u6599\u4E0E\u504F\u597D\u3002\u76F4\u63A5\u544A\u8BC9\u6211\u4F60\u60F3\u4E86\u89E3\u6216\u8C03\u6574\u4EC0\u4E48\u3002",
    explainSuggestion: "\u6982\u62EC\u4E00\u4E0B\u8FD9\u4E2A\u9879\u76EE\u76EE\u524D\u8BB0\u4F4F\u4E86\u4EC0\u4E48",
    organizeSuggestion: "\u5E2E\u6211\u68C0\u67E5\u8BB0\u5FC6\u4E2D\u662F\u5426\u6709\u8FC7\u65F6\u6216\u77DB\u76FE\u7684\u5185\u5BB9",
    profileSuggestion: "\u6211\u5E0C\u671B\u4F60\u8BB0\u4F4F\u54EA\u4E9B\u4E2A\u4EBA\u504F\u597D\uFF1F",
    managerInput: "\u8BB0\u5FC6\u7BA1\u7406\u8BF7\u6C42",
    managerPlaceholder: "\u8BE2\u95EE\u3001\u8865\u5145\u6216\u66F4\u6B63\u8FD9\u91CC\u7684\u8BB0\u5FC6\u2026",
    profileChatPlaceholder: "\u544A\u8BC9\u6211\u4F60\u7684\u504F\u597D\uFF0C\u6216\u4FEE\u6539\u5DF2\u6709\u8D44\u6599\u2026",
    managerScopeHint: "\u53EA\u5904\u7406\u5F53\u524D\u8303\u56F4\u7684\u8BB0\u5FC6",
    managerWorking: "\u6B63\u5728\u5904\u7406\u4F60\u7684\u8BF7\u6C42\u2026",
    you: "\u4F60",
    memoryAssistant: "\u8BB0\u5FC6\u52A9\u624B",
    confirmMemoryChange: "\u786E\u8BA4\u8FD9\u6B21\u6E05\u9664",
    confirmMemoryChangeHint: "\u8FD9\u9879\u64CD\u4F5C\u4F1A\u6E05\u9664\u6240\u5217\u8BB0\u5FC6\uFF0C\u8BF7\u786E\u8BA4\u540E\u7EE7\u7EED\u3002",
    confirmAction: "\u786E\u8BA4\u6E05\u9664",
    memoryPausedReadable: "\u5DE5\u4F5C\u5BF9\u8BDD\u4E2D\u7684\u8BB0\u5FC6\u529F\u80FD\u5DF2\u6682\u505C\uFF0C\u5DF2\u6709\u5185\u5BB9\u4ECD\u53EF\u5728\u8FD9\u91CC\u67E5\u770B\u3002",
    profileChatEmpty: "\u5728\u53F3\u4FA7\u544A\u8BC9\u6211\u4F60\u5E0C\u671B\u8DE8\u9879\u76EE\u4FDD\u7559\u7684\u4E2A\u4EBA\u504F\u597D\u3002",
    pageArea: "\u9875\u9762\u533A\u57DF",
    memoryDisplay: "\u8BB0\u5FC6\u5185\u5BB9",
    modelsAndConsolidation: "\u6A21\u578B\u4E0E\u6574\u7406",
    workspacePreferences: "\u5DE5\u4F5C\u533A\u8BBE\u7F6E",
    archiveAndHistory: "\u5F52\u6863\u4E0E\u5386\u53F2",
    archiveHint: "\u8FD9\u91CC\u7BA1\u7406\u4FDD\u7559\u7684\u5DE5\u4F5C\u533A\u8BB0\u5FC6\uFF0C\u4EE5\u53CA\u9700\u8981\u7EB3\u5165\u8BB0\u5FC6\u7684\u5386\u53F2\u4F1A\u8BDD\u3002",
    retainedRead: "\u8BB0\u5FC6\u5DF2\u4FDD\u7559 \xB7 \u81EA\u52A8\u6574\u7406\u5DF2\u6682\u505C",
    noRetainedWorkspaces: "\u6CA1\u6709\u5DF2\u79FB\u9664\u5DE5\u4F5C\u533A\u7684\u8BB0\u5FC6\u3002",
    includeHistory: "\u7EB3\u5165\u5386\u53F2\u4F1A\u8BDD",
    includeHistoryHint: "\u4EC5\u5C06\u4F60\u9009\u4E2D\u7684\u5386\u53F2\u4F1A\u8BDD\u7EB3\u5165\u8BB0\u5FC6\u6574\u7406\uFF0C\u4E0D\u4F1A\u6062\u590D\u6216\u5220\u9664\u4F1A\u8BDD\u3002",
    useProjectMemory: "\u5728\u5DE5\u4F5C\u5BF9\u8BDD\u4E2D\u4F7F\u7528\u548C\u66F4\u65B0\u8BB0\u5FC6",
    useProjectMemoryHint: "\u63A7\u5236\u6B64\u9879\u76EE\u5728\u65E5\u5E38\u5DE5\u4F5C\u4E2D\u7684\u8BB0\u5FC6\u8BFB\u53D6\u4E0E\u81EA\u52A8\u66F4\u65B0\u3002\u5173\u95ED\u540E\u4ECD\u53EF\u5728\u8BB0\u5FC6\u9875\u9605\u8BFB\u3002",
    automaticConsolidation: "\u540E\u53F0\u81EA\u52A8\u6574\u7406",
    automaticConsolidationHint: "\u6709\u65B0\u589E\u8D44\u6599\u4E14\u9879\u76EE\u7A7A\u95F2\u65F6\u6574\u7406\u8BB0\u5FC6\uFF0C\u81F3\u5C11\u95F4\u9694 24 \u5C0F\u65F6\u3002",
    manager: "\u8BB0\u5FC6\u7BA1\u7406\u5BF9\u8BDD",
    currentWorkspaces: "\u8FD4\u56DE\u5F53\u524D\u5DE5\u4F5C\u533A",
    retainedWorkspaces: "\u5DF2\u79FB\u9664\u5DE5\u4F5C\u533A",
    automaticPaused: "\u81EA\u52A8\u6574\u7406\u5DF2\u6682\u505C",
    retainedHint: "\u6B64\u9879\u76EE\u5DF2\u4E0D\u5728\u5F53\u524D\u5DE5\u4F5C\u533A\u5217\u8868\u4E2D\u3002\u8BB0\u5FC6\u4ECD\u4FDD\u7559\uFF0C\u81EA\u52A8\u6574\u7406\u5DF2\u6682\u505C\uFF1B\u91CD\u65B0\u6DFB\u52A0\u540C\u4E00\u76EE\u5F55\u540E\u6062\u590D\u5173\u8054\u3002",
    untitledConversation: "\u672A\u547D\u540D\u4F1A\u8BDD",
    progress: "\u5F53\u524D\u8FDB\u5C55",
    blockers: "\u5F85\u89E3\u51B3\u7684\u95EE\u9898",
    next_actions: "\u4E0B\u4E00\u6B65",
    dreamIntervalHours: "\u81EA\u52A8\u6574\u7406\u6700\u5C0F\u95F4\u9694\uFF08\u5C0F\u65F6\uFF09",
    auditRetentionDays: "\u5BA1\u8BA1\u4E0E\u5DEE\u5F02\u4FDD\u7559\uFF08\u5929\uFF09",
    pageTitle: "\u8BB0\u5FC6",
    pageSubtitle: "\u91CD\u8981\u7EA6\u5B9A\u4E0E\u8FDB\u5C55\uFF0C\u968F\u9879\u76EE\u5EF6\u7EED",
    pageDescription: "\u67E5\u770B\u548C\u7BA1\u7406\u5DF2\u4FDD\u5B58\u7684\u7EA6\u5B9A\u4E0E\u8FDB\u5C55\uFF0C\u8BA9\u540E\u7EED\u5BF9\u8BDD\u63A5\u7740\u5DE5\u4F5C\u3002",
    chooseProject: "\u9009\u62E9\u5DE5\u4F5C\u533A",
    selectProject: "\u9009\u62E9\u9879\u76EE",
    projectPicker: "\u8BB0\u5FC6\u6240\u5C5E\u9879\u76EE",
    projectPlaceholder: "\u9009\u62E9\u9879\u76EE",
    projectMemory: "\u9879\u76EE\u8BB0\u5FC6",
    projectMemoryHint: "\u8FD9\u91CC\u7684\u8BB0\u5FC6\u4EC5\u4F9B\u5F53\u524D\u9879\u76EE\u4F7F\u7528\u3002",
    projectEnabledHint: "\u65B0\u7684\u5DE5\u4F5C\u5185\u5BB9\u4F1A\u81EA\u52A8\u7EB3\u5165\u3002",
    enabledHint: "\u65B0\u7684\u5DE5\u4F5C\u5185\u5BB9\u4F1A\u81EA\u52A8\u7EB3\u5165",
    projectDisabledHint: "\u5DF2\u6682\u505C\u4F7F\u7528\u548C\u66F4\u65B0\uFF0C\u73B0\u6709\u8BB0\u5FC6\u4ECD\u4F1A\u4FDD\u7559\u3002",
    projectCount: "{count} \u4E2A\u9879\u76EE",
    noProjects: "\u8FD8\u6CA1\u6709\u9879\u76EE\u8BB0\u5FC6",
    noProjectsHint: "\u6253\u5F00\u4E00\u4E2A\u9879\u76EE\u5F00\u59CB\u5DE5\u4F5C\u540E\uFF0C\u4F1A\u5728\u8FD9\u91CC\u51FA\u73B0\u3002",
    globalScope: "\u6240\u6709\u9879\u76EE",
    scopeHint: "\u9879\u76EE\u8BB0\u5FC6\u5F7C\u6B64\u9694\u79BB\uFF1B\u5168\u5C40\u8D44\u6599\u9002\u7528\u4E8E\u6240\u6709\u9879\u76EE\u3002",
    all: "\u5168\u90E8",
    libraryTitle: "\u8BB0\u5FC6\u5E93",
    libraryHint: "\u9ED8\u8BA4\u5C55\u793A\u5F53\u524D\u6709\u6548\u7684\u8BB0\u5FC6",
    allMemories: "\u5168\u90E8\u8BB0\u5FC6",
    memoryCount: "{count} \u6761\u8BB0\u5FC6",
    activeHint: "\u4E0E\u5F53\u524D\u5DE5\u4F5C\u6709\u5173\u3001\u53EF\u80FD\u7EE7\u7EED\u53D8\u5316\u7684\u4FE1\u606F\u3002",
    stableHint: "\u76F8\u5BF9\u7A33\u5B9A\u7684\u7EA6\u5B9A\u3001\u4E8B\u5B9E\u4E0E\u65B9\u6CD5\u3002",
    historyHint: "\u5DF2\u5F52\u6863\u6216\u64A4\u9500\u7684\u8BB0\u5F55\uFF0C\u4EC5\u4F9B\u8FFD\u6EAF\u3002",
    selectMemory: "\u9009\u62E9\u4E00\u6761\u8BB0\u5FC6",
    selectMemoryHint: "\u5728\u8FD9\u91CC\u67E5\u770B\u5B8C\u6574\u5185\u5BB9\u4E0E\u9002\u7528\u6761\u4EF6\u3002",
    chooseMemory: "\u9009\u62E9\u4E00\u6761\u8BB0\u5FC6",
    chooseMemoryHint: "\u67E5\u770B\u5B83\u7684\u5185\u5BB9\u3001\u6765\u6E90\u548C\u9002\u7528\u6761\u4EF6\u3002",
    noMatches: "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6",
    emptySearch: "\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u8BB0\u5FC6\u3002",
    clearSearch: "\u6E05\u9664\u7B5B\u9009",
    details: "\u8BE6\u60C5",
    memoryDetails: "\u8BB0\u5FC6\u8BE6\u60C5",
    rawContent: "\u539F\u59CB\u5185\u5BB9",
    backToList: "\u8FD4\u56DE\u5217\u8868",
    untitledMemory: "\u672A\u547D\u540D\u8BB0\u5FC6",
    lastUpdated: "\u6700\u8FD1\u66F4\u65B0",
    createdAt: "\u521B\u5EFA\u65F6\u95F4",
    group: "\u5206\u7EC4",
    showIssues: "\u5F85\u786E\u8BA4\uFF08{count}\uFF09",
    openIssues: "\u67E5\u770B {count} \u4E2A\u5F85\u786E\u8BA4\u95EE\u9898",
    issuesSummary: "\u6709 {count} \u4E2A\u95EE\u9898\u9700\u8981\u4F60\u7684\u51B3\u5B9A",
    allCaughtUp: "\u6682\u65E0\u5F85\u786E\u8BA4\u95EE\u9898",
    manageAction: "\u7BA1\u7406\u8BB0\u5FC6",
    manageTitle: "\u544A\u8BC9 Agent \u4F60\u60F3\u8C03\u6574\u4EC0\u4E48",
    manageOpen: "\u901A\u8FC7\u5BF9\u8BDD\u8C03\u6574\u8BB0\u5FC6",
    manageClose: "\u6536\u8D77\u7BA1\u7406\u5BF9\u8BDD",
    manageSession: "\u63A5\u6536\u8BF7\u6C42\u7684\u4F1A\u8BDD",
    manageSessionHint: "\u6CBF\u7528\u6240\u9009\u4F1A\u8BDD\u7684\u6A21\u578B\u4E0E\u6743\u9650\uFF0C\u5904\u7406\u7ED3\u679C\u4F1A\u5728\u8BE5\u4F1A\u8BDD\u8FD4\u56DE\u3002",
    selectManageSession: "\u9009\u62E9\u63A5\u6536\u8BF7\u6C42\u7684\u4F1A\u8BDD",
    chooseConversation: "\u9009\u62E9\u63A5\u6536\u8BF7\u6C42\u7684\u4F1A\u8BDD",
    conversationRequired: "\u5148\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD",
    noManageSession: "\u5148\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u518D\u53D1\u9001\u7BA1\u7406\u8BF7\u6C42\u3002",
    noConversations: "\u8FD9\u4E2A\u9879\u76EE\u8FD8\u6CA1\u6709\u53EF\u7528\u4F1A\u8BDD\uFF0C\u8BF7\u5148\u5728\u5DE5\u4F5C\u533A\u65B0\u5EFA\u4F1A\u8BDD\u3002",
    sendRequest: "\u53D1\u9001\u8BF7\u6C42",
    manageTarget: "\u8BF7\u6C42\u4F1A\u53D1\u9001\u5230\u6240\u9009\u4F1A\u8BDD\uFF0C\u7531 Agent \u5904\u7406\u5E76\u8FD4\u56DE\u5B9E\u9645\u7ED3\u679C\u3002",
    openConversation: "\u6253\u5F00\u4F1A\u8BDD",
    goToConversation: "\u524D\u5F80\u4F1A\u8BDD\u67E5\u770B\u7ED3\u679C",
    moreActions: "\u66F4\u591A\u64CD\u4F5C",
    libraryTools: "\u8BB0\u5FC6\u5E93\u5DE5\u5177",
    backToMemory: "\u8FD4\u56DE\u8BB0\u5FC6\u5E93",
    cancel: "\u53D6\u6D88",
    back: "\u8FD4\u56DE",
    sessionCount: "{count} \u4E2A\u4F1A\u8BDD",
    selectedCount: "\u5DF2\u9009 {count} \u4E2A",
    noChangesYet: "\u8FD8\u6CA1\u6709\u53D8\u66F4\u8BB0\u5F55",
    viewChanges: "\u67E5\u770B\u53D8\u66F4",
    viewDetails: "\u67E5\u770B\u8BE6\u60C5",
    showDetails: "\u5C55\u5F00\u8BE6\u60C5",
    collapseDetails: "\u6536\u8D77\u8BE6\u60C5",
    profileTitle: "\u5173\u4E8E\u4F60",
    profileSubtitle: "\u6240\u6709\u9879\u76EE\u5171\u7528\u7684\u8D44\u6599\u4E0E\u504F\u597D",
    profileScopeHint: "\u8FD9\u91CC\u4F9B\u6240\u6709\u9879\u76EE\u5171\u7528\uFF1B\u9879\u76EE\u7EA6\u5B9A\u7559\u5728\u5BF9\u5E94\u7684\u9879\u76EE\u8BB0\u5FC6\u4E2D\u3002",
    profileControls: "\u8D44\u6599\u4F7F\u7528\u65B9\u5F0F",
    automaticMaintenance: "\u81EA\u52A8\u7EF4\u62A4\u8D44\u6599",
    settingsDescription: "\u81EA\u52A8\u6574\u7406\u548C\u6A21\u578B\u8BBE\u7F6E",
    advanced: "\u9AD8\u7EA7\u8BBE\u7F6E",
    advancedSettings: "\u9AD8\u7EA7\u8BBE\u7F6E",
    generalSettings: "\u6574\u7406\u4E0E\u4FDD\u7559",
    modelsHint: "\u9636\u6BB5\u5BA1\u8BA1\u9ED8\u8BA4\u6CBF\u7528\u53D1\u8D77\u4F1A\u8BDD\uFF1B\u81EA\u52A8\u6574\u7406\u4E0E\u72EC\u7ACB\u5BA1\u67E5\u53EF\u5206\u522B\u9009\u62E9\u6A21\u578B\u3002",
    dailySchedule: "\u81EA\u52A8\u6574\u7406\u95F4\u9694\u81F3\u5C11 {hours} \u5C0F\u65F6",
    budgetDetails: "\u9884\u7B97\u4E0E\u7528\u91CF\u8BF4\u660E",
    usageDetails: "\u67E5\u770B\u7528\u91CF",
    taskDetails: "\u4EFB\u52A1\u8BE6\u60C5",
    saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
    working: "\u5904\u7406\u4E2D\u2026",
    copy: "\u590D\u5236",
    copied: "\u5DF2\u590D\u5236",
    code: "\u4EE3\u7801",
    wrap: "\u81EA\u52A8\u6362\u884C",
    unwrap: "\u53D6\u6D88\u6362\u884C",
    footnotes: "\u6CE8\u811A",
    usageCalls: "\u6A21\u578B\u8C03\u7528",
    usageTotal: "\u603B\u7528\u91CF\uFF08tokens\uFF09",
    usageCacheRead: "\u7F13\u5B58\u8BFB\u53D6\uFF08tokens\uFF09",
    usageCost: "\u63D0\u4F9B\u65B9\u62A5\u544A\u7684\u8D39\u7528",
    usageNote: "\u7528\u91CF\u6309\u63D0\u4F9B\u65B9\u8FD4\u56DE\u7684\u5B57\u6BB5\u663E\u793A\uFF0C\u7F3A\u5931\u8BB0\u4E3A\u672A\u77E5\u3002\u7F13\u5B58\u8BFB\u53D6\u4E0D\u4EE3\u8868\u5168\u90E8\u8F93\u5165\u91CF\uFF0C\u4E5F\u4E0D\u53E6\u52A0\u5230\u603B\u7528\u91CF\u3002",
    budgetEstimateHint: "\u540E\u53F0\u6574\u7406\u548C\u9636\u6BB5\u5BA1\u8BA1\u4F18\u5148\u91C7\u7528\u5BBF\u4E3B token \u4F30\u7B97\u5E76\u9884\u7559\u4F59\u91CF\uFF1B\u65E0\u6CD5\u53EF\u9760\u4F30\u7B97\u65F6\u91C7\u7528\u66F4\u4FDD\u5B88\u7684\u5B57\u8282\u4E0A\u754C\u3002\u4E0D\u4F1A\u622A\u65AD G2 \u4E0A\u4E0B\u6587\u3002\u9884\u7B97\u7528\u4E8E\u4F30\u7B97\u4FDD\u62A4\uFF0C\u5B9E\u9645\u7528\u91CF\u4EE5\u63D0\u4F9B\u65B9\u8FD4\u56DE\u4E3A\u51C6\uFF0C\u7F3A\u5931\u4E0D\u8BA1\u4F5C\u96F6\u3002",
    tab: "\u8BB0\u5FC6",
    guide: "\u9879\u76EE\u8BB0\u5FC6\u3001\u6574\u7406\u52A8\u6001\u4E0E\u5168\u5C40\u8D44\u6599",
    title: "\u8BB0\u5FC6",
    project: "\u5F53\u524D\u9879\u76EE",
    enabled: "\u5DF2\u5F00\u542F",
    disabled: "\u5DF2\u5173\u95ED",
    enableProject: "\u9879\u76EE\u81EA\u52A8\u8BB0\u5FC6",
    projectOff: "\u9879\u76EE\u8BB0\u5FC6\u5DF2\u6682\u505C\u3002\u5DF2\u6709\u5185\u5BB9\u4FDD\u7559\uFF0C\u91CD\u65B0\u5F00\u542F\u540E\u7EE7\u7EED\u4F7F\u7528\u3002",
    noProject: "\u5F53\u524D\u4F1A\u8BDD\u5C1A\u672A\u7ED1\u5B9A\u9879\u76EE\u3002",
    noSession: "\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD\u4EE5\u53D1\u9001\u8BB0\u5FC6\u7BA1\u7406\u8BF7\u6C42\u3002",
    refresh: "\u5237\u65B0",
    loading: "\u6B63\u5728\u8BFB\u53D6\u8BB0\u5FC6\u2026",
    unavailable: "\u8BB0\u5FC6\u670D\u52A1\u6682\u4E0D\u53EF\u7528",
    retry: "\u91CD\u8BD5",
    accessDenied: "\u5F53\u524D\u8FDE\u63A5\u65E0\u6743\u8BBF\u95EE\u8FD9\u4EFD\u8BB0\u5FC6\u3002",
    responseInvalid: "\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u7ED3\u679C\u3002",
    sessionMismatch: "\u4F1A\u8BDD\u5DF2\u5207\u6362\uFF0C\u5DF2\u5FFD\u7565\u5176\u4ED6\u4F1A\u8BDD\u7684\u7ED3\u679C\u3002",
    requestFailed: "\u64CD\u4F5C\u672A\u5B8C\u6210",
    close: "\u5173\u95ED",
    more: "\u66F4\u591A",
    memories: "\u8BB0\u5FC6\u5E93",
    activity: "\u6574\u7406\u52A8\u6001",
    issues: "\u5F85\u88C1\u51B3",
    profile: "\u5168\u5C40\u8D44\u6599",
    sessions: "\u7EB3\u5165\u5386\u53F2\u4F1A\u8BDD",
    settings: "\u8BBE\u7F6E",
    stable: "\u7A33\u5B9A",
    active: "\u6D3B\u8DC3",
    history: "\u5386\u53F2",
    search: "\u7B5B\u9009\u8BB0\u5FC6\u6807\u9898\u6216\u5206\u7EC4",
    emptyMemories: "\u8FD8\u6CA1\u6709\u8BB0\u5FC6",
    read: "\u9605\u8BFB",
    readFailed: "\u65E0\u6CD5\u8BFB\u53D6\u8FD9\u6761\u8BB0\u5FC6\u3002",
    current: "\u5F53\u524D",
    archived: "\u5DF2\u5F52\u6863",
    retracted: "\u5DF2\u64A4\u9500",
    deleted: "\u5DF2\u5220\u9664",
    not_found: "\u672A\u627E\u5230",
    version: "\u7248\u672C",
    conditions: "\u9002\u7528\u6761\u4EF6",
    sources: "\u6765\u6E90",
    incompleteList: "\u8FD9\u91CC\u53EA\u663E\u793A\u90E8\u5206\u8BB0\u5FC6\u3002\u53EF\u901A\u8FC7\u201C\u7BA1\u7406\u8BB0\u5FC6\u201D\u67E5\u8BE2\u66F4\u591A\u5185\u5BB9\u3002",
    manageMemory: "\u4FEE\u6539\u8FD9\u6761\u8BB0\u5FC6",
    activityIntro: "\u4EC5\u5C55\u793A\u81EA\u52A8\u6574\u7406\u5DF2\u6B63\u5F0F\u751F\u6548\u7684\u4FEE\u6539\u3002\u666E\u901A\u5DE5\u4F5C\u4E2D\u7684\u8BB0\u5FC6\u66F4\u65B0\u4E0D\u4F1A\u52A0\u5165\u6B64\u52A8\u6001\u6D41\u3002",
    emptyActivity: "\u8FD8\u6CA1\u6709\u81EA\u52A8\u6574\u7406\u7684\u6709\u6548\u4FEE\u6539\u3002",
    dream: "\u7ACB\u5373\u6574\u7406",
    dreamHint: "\u4F1A\u8C03\u7528\u6A21\u578B\u6574\u7406\u5F53\u524D\u9879\u76EE\u3002\u81EA\u52A8\u6574\u7406\u81F3\u5C11\u95F4\u9694 24 \u5C0F\u65F6\uFF0C\u5E76\u7B49\u5F85\u9879\u76EE\u7A7A\u95F2\u4E14\u6709\u65B0\u8D44\u6599\u3002",
    before: "\u4FEE\u6539\u524D",
    after: "\u4FEE\u6539\u540E",
    reason: "\u7406\u7531",
    review: "\u72EC\u7ACB\u5BA1\u67E5\u610F\u89C1",
    reviewHint: "\u610F\u89C1\u9488\u5BF9\u63D0\u4EA4\u524D\u7684\u5019\u9009\uFF1B\u6700\u7EC8\u7248\u672C\u53EF\u80FD\u5DF2\u6839\u636E\u610F\u89C1\u8C03\u6574\u3002",
    contentUnavailable: "\u76F8\u5173\u5185\u5BB9\u672A\u4FDD\u7559\u6216\u5DF2\u6E05\u9664\u3002",
    diagnostics: "\u540E\u53F0\u4EFB\u52A1",
    emptyJobs: "\u6CA1\u6709\u540E\u53F0\u4EFB\u52A1\u8BB0\u5F55\u3002",
    job: "\u4EFB\u52A1",
    queued: "\u6392\u961F\u4E2D",
    running: "\u8FDB\u884C\u4E2D",
    completed: "\u5DF2\u5B8C\u6210",
    failed: "\u5931\u8D25",
    cancelled: "\u5DF2\u53D6\u6D88",
    rejected: "\u5DF2\u62D2\u7EDD",
    deferred: "\u5DF2\u5EF6\u540E",
    issuesIntro: "\u8FD9\u91CC\u53EA\u5217\u51FA\u65E0\u6CD5\u81EA\u884C\u6838\u5B9E\u7684\u51B2\u7A81\u3002\u63D0\u4F9B\u4F60\u7684\u51B3\u5B9A\u540E\uFF0CAgent \u4F1A\u8BFB\u53D6\u6700\u65B0\u7248\u672C\u5E76\u63D0\u4EA4\u4FEE\u6539\u3002",
    emptyIssues: "\u6CA1\u6709\u5F85\u88C1\u51B3\u7684\u51B2\u7A81\u3002",
    affected: "\u76F8\u5173\u8BB0\u5FC6",
    decision: "\u4F60\u7684\u51B3\u5B9A",
    decisionPlaceholder: "\u8BF4\u660E\u5E94\u4FDD\u7559\u54EA\u4E2A\u7ED3\u8BBA\u3001\u9002\u7528\u6761\u4EF6\u6216\u65B0\u7684\u4F9D\u636E\u2026",
    submitDecision: "\u63D0\u4EA4\u51B3\u5B9A",
    issueSubmitted: "\u88C1\u51B3\u8BF7\u6C42\u5DF2\u53D1\u9001\uFF1B\u53EA\u6709\u5B9E\u9645\u63D0\u4EA4\u6210\u529F\u540E\u95EE\u9898\u624D\u4F1A\u5173\u95ED\u3002",
    profileIntro: "\u9002\u7528\u4E8E\u6240\u6709\u9879\u76EE\u7684\u4E2A\u4EBA\u8D44\u6599\u3001\u504F\u597D\u4E0E\u534F\u4F5C\u4E60\u60EF\u3002\u9879\u76EE\u4E13\u5C5E\u4FE1\u606F\u4ECD\u4FDD\u5B58\u5728\u5BF9\u5E94\u9879\u76EE\u3002",
    profileEnabled: "\u5728\u5BF9\u8BDD\u4E2D\u4F7F\u7528\u5168\u5C40\u8D44\u6599",
    autoWrite: "\u5141\u8BB8 Agent \u81EA\u52A8\u7EF4\u62A4",
    profileEmpty: "\u5168\u5C40\u8D44\u6599\u5C1A\u4E3A\u7A7A\u3002",
    editProfile: "\u901A\u8FC7\u5BF9\u8BDD\u4FEE\u6539\u5168\u5C40\u8D44\u6599",
    profileChanges: "\u5168\u5C40\u8D44\u6599\u53D8\u66F4",
    emptyProfileChanges: "\u8FD8\u6CA1\u6709\u5168\u5C40\u8D44\u6599\u53D8\u66F4\u8BB0\u5F55\u3002",
    profileHint: "\u5728\u53F3\u4FA7\u5BF9\u8BDD\u4E2D\u76F4\u63A5\u4FEE\u6539\u8D44\u6599\uFF0C\u5B9E\u9645\u53D8\u66F4\u548C\u6765\u6E90\u53EF\u5728\u52A8\u6001\u4E2D\u67E5\u770B\u3002",
    sessionsIntro: "\u53EA\u6709\u4F60\u9009\u4E2D\u7684\u65E7\u4F1A\u8BDD\u4F1A\u8FDB\u5165\u5386\u53F2\u6574\u7406\u8303\u56F4\u3002\u5F00\u542F\u540E\u7684\u65B0\u8D44\u6599\u4F1A\u81EA\u52A8\u7EB3\u5165\uFF1B\u8FD9\u91CC\u7684\u9009\u62E9\u4E0D\u4F1A\u5220\u9664\u5DF2\u6709\u8BB0\u5FC6\u3002",
    emptySessions: "\u672A\u627E\u5230\u53EF\u7EB3\u5165\u7684\u65E7\u4F1A\u8BDD\u3002",
    included: "\u5DF2\u7EB3\u5165",
    selectSession: "\u7EB3\u5165\u4F1A\u8BDD {title}",
    includeSelected: "\u7EB3\u5165\u9009\u4E2D\u7684 {count} \u4E2A\u4F1A\u8BDD",
    selectionEmpty: "\u5148\u9009\u62E9\u8981\u7EB3\u5165\u7684\u65E7\u4F1A\u8BDD\u3002",
    sessionFilter: "\u7B5B\u9009\u4F1A\u8BDD\u6807\u9898",
    settingsIntro: "\u6A21\u578B\u4E0E\u9884\u7B97\u5F71\u54CD\u540E\u53F0\u6574\u7406\u7684\u8D39\u7528\u548C\u6548\u679C\u3002\u9879\u76EE\u5F00\u5173\u4E0E\u5168\u5C40\u8D44\u6599\u5F00\u5173\u5206\u522B\u751F\u6548\u3002",
    models: "\u6A21\u578B",
    g2: "\u9636\u6BB5\u5BA1\u8BA1 G2",
    dreamer: "\u81EA\u52A8\u6574\u7406 Dreamer",
    reviewer: "\u72EC\u7ACB\u5BA1\u67E5 Reviewer",
    followSession: "\u7559\u7A7A\u65F6\u8DDF\u968F\u53D1\u8D77\u4F1A\u8BDD",
    chooseModel: "\u4E3A\u6B64\u89D2\u8272\u660E\u786E\u9009\u62E9\u63D0\u4F9B\u65B9\u4E0E\u6A21\u578B\u3002",
    provider: "\u63D0\u4F9B\u65B9",
    model: "\u6A21\u578B",
    noModels: "\u4E5F\u53EF\u586B\u5199\u5BBF\u4E3B\u5DF2\u914D\u7F6E\u7684\u63D0\u4F9B\u65B9\u4E0E\u6A21\u578B\u3002",
    interval: "\u81EA\u52A8\u6574\u7406\u6700\u5C0F\u95F4\u9694\uFF08\u5C0F\u65F6\uFF09",
    intervalHint: "\u81F3\u5C11 24 \u5C0F\u65F6\uFF1B\u6CA1\u6709\u65B0\u589E\u8D44\u6599\u65F6\u4E0D\u8FD0\u884C\u3002",
    retention: "\u5BA1\u8BA1\u4E0E\u5DEE\u5F02\u4FDD\u7559\uFF08\u5929\uFF09",
    retentionHint: "\u6B64\u671F\u9650\u4E0D\u81EA\u52A8\u5220\u9664\u6B63\u5F0F\u8BB0\u5FC6\u3002",
    budgets: "\u540E\u53F0\u9884\u7B97",
    maxInputTokens: "\u5355\u6B21\u8F93\u5165\u4E0A\u9650\uFF08tokens\uFF09",
    maxOutputTokens: "\u5355\u6B21\u8F93\u51FA\u4E0A\u9650\uFF08tokens\uFF09",
    maxSteps: "\u5355\u8F6E\u6700\u591A\u6A21\u578B\u6B65\u9AA4",
    maxDailyTokens: "\u6BCF\u65E5\u540E\u53F0\u7528\u91CF\u4E0A\u9650\uFF08tokens\uFF09",
    save: "\u4FDD\u5B58\u8BBE\u7F6E",
    invalidNumber: "\u8BF7\u4E3A\u201C{field}\u201D\u586B\u5199\u6709\u6548\u6574\u6570\u3002",
    invalidModel: "\u8BF7\u540C\u65F6\u586B\u5199\u63D0\u4F9B\u65B9\u4E0E\u6A21\u578B\uFF1B\u53EA\u6709 G2 \u53EF\u4EE5\u5C06\u4E24\u8005\u7559\u7A7A\u4EE5\u8DDF\u968F\u53D1\u8D77\u4F1A\u8BDD\u3002",
    manage: "\u901A\u8FC7\u5BF9\u8BDD\u7BA1\u7406",
    manageHint: "\u8BF7\u6C42\u4F1A\u53D1\u9001\u5230\u6240\u9009 DSH \u4F1A\u8BDD\uFF0C\u6CBF\u7528\u5B83\u7684\u6A21\u578B\u3001\u6743\u9650\u548C\u5DE5\u5177\u56DE\u6267\u3002",
    managePlaceholder: "\u4F8B\u5982\uFF1A\u8BB0\u4F4F\u672C\u9879\u76EE\u7684\u7EA6\u675F\u3001\u89E3\u91CA\u4E00\u6761\u8BB0\u5FC6\u3001\u4FEE\u8BA2\u6216\u5220\u9664\u8FC7\u65F6\u5185\u5BB9\u2026",
    send: "\u53D1\u9001\u8BF7\u6C42",
    projectScope: "\u672C\u9879\u76EE",
    userScope: "\u5168\u5C40\u8D44\u6599",
    nativeUnavailable: "\u5F53\u524D\u5BBF\u4E3B\u672A\u63D0\u4F9B\u81EA\u7136\u8BED\u8A00\u7BA1\u7406\u5165\u53E3\u3002",
    textRequired: "\u5148\u8F93\u5165\u4F60\u7684\u8BF7\u6C42\u3002",
    receipt: "\u64CD\u4F5C\u56DE\u6267",
    accepted: "\u5DF2\u63A5\u53D7\uFF0C\u7B49\u5F85\u5904\u7406",
    committed: "\u5DF2\u6B63\u5F0F\u751F\u6548",
    no_change: "\u6CA1\u6709\u9700\u8981\u4FEE\u6539\u7684\u5185\u5BB9",
    cleanupPending: "\u6B63\u5F0F\u6761\u76EE\u5DF2\u5220\u9664\uFF0C\u8F85\u52A9\u526F\u672C\u4ECD\u5728\u6E05\u7406\u3002",
    cleanupIncomplete: "\u90E8\u5206\u526F\u672C\u5C1A\u672A\u6E05\u9664\uFF0C\u6E05\u9664\u8BF7\u6C42\u5C1A\u672A\u5B8C\u6210\u3002",
    requestId: "\u8BF7\u6C42",
    savedSettings: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
    source: "\u6765\u6E90",
    unknown: "\u672A\u77E5",
    open: "\u6253\u5F00",
    formatLocale: "zh-CN"
  };
  var en = {
    refreshStatus: "Refresh status",
    resendRequest: "Resend request",
    reviewResult: "Verify result",
    failureDetails: "View failure details",
    failureCode: "Error code",
    failureStage: "Failure stage",
    managerStep: "Step {step}",
    managerModelCall: "Model call",
    managerStage_prepare: "Preparing context",
    managerStage_budget: "Checking usage",
    managerStage_model: "Model response",
    managerStage_tool: "Reading or updating memory",
    managerStage_confirmation: "Awaiting clearing confirmation",
    managerStage_completed: "Completed",
    managerStage_cancelled: "Stopped",
    "managerStage_step-limit": "Step limit reached",
    deliveryUnconfirmed: "Delivery is unconfirmed. Refresh status or resend the same content; the request will not be submitted twice.",
    managerFailure: "This request did not finish. Check the reason and verify its current result.",
    managerAuthError: "The model credential is unavailable. Check model settings.",
    managerRateLimitError: "The provider is rate limited. Try resending later.",
    managerBudgetError: "The daily model usage limit has been reached.",
    managerContextError: "This conversation reached its context limit. Reopen the workspace to start fresh.",
    managerTimeoutError: "This request timed out. Verify its result first.",
    managerStepError: "This request reached its step limit. Verify its result first.",
    managerWritesCommitted: "Some changes were saved. Verify result only checks current memory and does not repeat changes.",
    managerWritesUncertain: "A modification has an uncertain outcome. Verify result checks current state without repeating writes.",
    historyPausedHint: "Memory is off for this workspace. Enable it in Workspace settings to include past conversations.",
    historySelectable: "Past conversations you can include",
    historyCovered: "Already in memory scope",
    historyCoveredHint: "These conversations are already included; there is no need to select them again. Inclusion describes the managed scope, not a guarantee that every message is saved as a memory.",
    noMatchingSessions: "No matching conversations",
    backToArchive: "Back to archive and history",
    backToSettings: "Back to settings",
    backToWorkspaceMemory: "Back to workspace memory",
    backToProfile: "Back to user profile",
    topicsOrganized: "Topics reorganized ({count})",
    issueResolved: "Question resolved",
    defaultWorkspace: "Default workspace",
    homeSubtitle: "Choose a workspace to understand and manage what it remembers.",
    workspaces: "Workspaces",
    openWorkspaceMemory: "Open memory for {name}",
    workspaceCardHint: "Project overview, topics and important decisions",
    openMemory: "View memory",
    noWorkspaces: "No workspaces yet",
    noWorkspacesHint: "Add a workspace in the sidebar to see its memory here.",
    backToWorkspaces: "All workspaces",
    currentMemory: "Current memory",
    memoryActivity: "Memory activity",
    memoryActivityIntro: "Changes from everyday work, your requests and background consolidation appear here.",
    emptyMemoryActivity: "No memory changes yet",
    emptyMemoryActivityHint: "Saved and updated memories will appear here.",
    ordinaryUpdate: "Everyday memory",
    stageUpdate: "Stage review",
    requestedUpdate: "Your request",
    automaticUpdate: "Background consolidation",
    askAboutChange: "Ask about this change",
    recentConsolidations: "Consolidation runs",
    consolidationFailed: "This run did not finish. Existing memories are retained. Expand details for the cause.",
    waitingModel: "Waiting for model service",
    modelWaitHint: "The selected model is not configured on this host. A Desktop or Web host with that model can process the task. It will not switch models automatically.",
    projectOverview: "Project overview",
    overviewTitle: "What this project remembers",
    overviewEmpty: "Important decisions and progress will collect here. You can also tell me what to remember in the conversation.",
    overviewPending: "Saved entries are available under All memories.",
    overviewStale: "Memories changed; the overview is being updated.",
    topics: "Read by topic",
    topicMemory: "Topic memory",
    viewTopic: "Open topic",
    topicRead: "Read the memories in this topic.",
    topicEmpty: "Saved memories are organized into topics. You can adjust them through conversation.",
    emptyHistory: "No historical memories yet",
    discussMemory: "Discuss this memory",
    needsDecision: "Your decision needed",
    issueChatHint: "Explain your decision in the conversation, or ask about the disagreement first. Related memories update when it is resolved.",
    discussIssue: "Discuss and resolve",
    wholeProject: "Whole project",
    managerTitle: "Memory conversation",
    managerSubtitle: "Understand, add to or revise these memories",
    managerMessages: "Memory management conversation",
    managerWelcome: "Talk about what is remembered",
    managerWelcomeProject: "Ask what the project remembers, or tell me what needs adding or changing.",
    managerWelcomeUser: "Manage personal facts and preferences shared across projects. Tell me what you want to understand or change.",
    explainSuggestion: "Summarize what this project currently remembers",
    organizeSuggestion: "Check for outdated or conflicting memories",
    profileSuggestion: "Which personal preferences should you remember?",
    managerInput: "Memory management request",
    managerPlaceholder: "Ask about, add to or revise these memories\u2026",
    profileChatPlaceholder: "Tell me your preferences or update your profile\u2026",
    managerScopeHint: "Only manages memory in this scope",
    managerWorking: "Working on your request\u2026",
    you: "You",
    memoryAssistant: "Memory assistant",
    confirmMemoryChange: "Confirm this clearing request",
    confirmMemoryChangeHint: "This will clear the listed memories. Confirm to continue.",
    confirmAction: "Confirm clearing",
    memoryPausedReadable: "Memory use in work conversations is paused. You can still read saved entries here.",
    profileChatEmpty: "Use the conversation to describe preferences you want remembered across projects.",
    pageArea: "Page area",
    memoryDisplay: "Memory content",
    modelsAndConsolidation: "Models and consolidation",
    workspacePreferences: "Workspace settings",
    archiveAndHistory: "Archive and history",
    archiveHint: "Manage retained workspace memories and choose past conversations to include in memory.",
    retainedRead: "Memory retained \xB7 automatic consolidation paused",
    noRetainedWorkspaces: "No retained memories from removed workspaces.",
    includeHistory: "Include past conversations",
    includeHistoryHint: "Only selected past conversations enter memory consolidation. This does not restore or delete conversations.",
    useProjectMemory: "Use and update memory in work conversations",
    useProjectMemoryHint: "Controls memory use and automatic updates during everyday work. Saved memory remains readable here when off.",
    automaticConsolidation: "Automatic background consolidation",
    automaticConsolidationHint: "Consolidate new material while the project is idle, at least 24 hours apart.",
    manager: "Memory conversation",
    currentWorkspaces: "Back to current workspaces",
    retainedWorkspaces: "Removed workspaces",
    automaticPaused: "Automatic consolidation paused",
    retainedHint: "This project is no longer in the workspace list. Memories are retained and automatic consolidation is paused. Adding the same directory restores the association.",
    untitledConversation: "Untitled conversation",
    progress: "Progress",
    blockers: "Open problems",
    next_actions: "Next steps",
    dreamIntervalHours: "Minimum automatic interval (hours)",
    auditRetentionDays: "Audit and difference retention (days)",
    pageTitle: "Memory",
    pageSubtitle: "Keep important decisions and progress with each project",
    pageDescription: "Review and manage saved context so future conversations can pick up where you left off.",
    chooseProject: "Choose a workspace",
    selectProject: "Choose a project",
    projectPicker: "Memory project",
    projectPlaceholder: "Choose a project",
    projectMemory: "Project memory",
    projectMemoryHint: "These memories are used only in the selected project.",
    projectEnabledHint: "New work is included automatically.",
    enabledHint: "New work is included automatically",
    projectDisabledHint: "Memory use and updates are paused. Existing entries are kept.",
    projectCount: "{count} projects",
    noProjects: "No project memory yet",
    noProjectsHint: "Open a project and start working. Its memory will appear here.",
    globalScope: "All projects",
    scopeHint: "Project memories stay separate. The global profile applies across projects.",
    all: "All",
    libraryTitle: "Library",
    libraryHint: "Currently effective memories are shown by default",
    allMemories: "All memories",
    memoryCount: "Entries: {count}",
    activeHint: "Information related to current work that may continue to change.",
    stableHint: "Established decisions, facts, and methods.",
    historyHint: "Archived or retracted records, kept for reference.",
    selectMemory: "Select a memory",
    selectMemoryHint: "Read its full content and when it applies here.",
    chooseMemory: "Select a memory",
    chooseMemoryHint: "Read its content, sources, and conditions.",
    noMatches: "No matching memories",
    emptySearch: "No memories match this search.",
    clearSearch: "Clear filters",
    details: "Details",
    memoryDetails: "Memory details",
    rawContent: "Raw content",
    backToList: "Back to list",
    untitledMemory: "Untitled memory",
    lastUpdated: "Last updated",
    createdAt: "Created",
    group: "Group",
    showIssues: "Needs your input ({count})",
    openIssues: "View {count} unresolved questions",
    issuesSummary: "{count} questions need your decision",
    allCaughtUp: "No questions need your input",
    manageAction: "Manage memory",
    manageTitle: "Tell the agent what you want to change",
    manageOpen: "Adjust memory through conversation",
    manageClose: "Close conversation controls",
    manageSession: "Conversation for this request",
    manageSessionHint: "The selected conversation supplies the model and permissions and receives the result.",
    selectManageSession: "Choose a conversation",
    chooseConversation: "Choose a conversation",
    conversationRequired: "Choose a conversation first",
    noManageSession: "Choose a conversation before sending a request.",
    noConversations: "This project has no available conversations. Create one in the workspace first.",
    sendRequest: "Send request",
    manageTarget: "Your request goes to the selected conversation. The agent processes it and returns the actual result.",
    openConversation: "Open conversation",
    goToConversation: "View the result in conversation",
    moreActions: "More actions",
    libraryTools: "Library tools",
    backToMemory: "Back to library",
    cancel: "Cancel",
    back: "Back",
    sessionCount: "{count} conversations",
    selectedCount: "{count} selected",
    noChangesYet: "No changes recorded yet",
    viewChanges: "View changes",
    viewDetails: "View details",
    showDetails: "Show details",
    collapseDetails: "Hide details",
    profileTitle: "About you",
    profileSubtitle: "Shared facts and preferences for every project",
    profileScopeHint: "Only personal information that applies across projects belongs here. Project decisions stay in project memory.",
    profileControls: "Profile preferences",
    automaticMaintenance: "Maintain profile automatically",
    settingsDescription: "Consolidation and model preferences",
    advanced: "Advanced",
    advancedSettings: "Advanced settings",
    generalSettings: "Consolidation and retention",
    modelsHint: "Stage audits follow their originating conversation by default. Consolidation and independent review can use separate models.",
    dailySchedule: "At least {hours} hours between automatic runs",
    budgetDetails: "Budget and usage details",
    usageDetails: "View usage",
    taskDetails: "Task details",
    saving: "Saving\u2026",
    working: "Working\u2026",
    copy: "Copy",
    copied: "Copied",
    code: "Code",
    wrap: "Wrap lines",
    unwrap: "Unwrap lines",
    footnotes: "Footnotes",
    usageCalls: "Model calls",
    usageTotal: "Total usage (tokens)",
    usageCacheRead: "Cache reads (tokens)",
    usageCost: "Provider-reported cost",
    usageNote: "Usage reflects fields reported by the provider; missing values are unknown. Cache reads are not the full input count and are not added again to total usage.",
    budgetEstimateHint: "Consolidation and stage audits prefer the host token estimate with a safety margin, falling back to a more conservative byte bound when reliable estimation is unavailable. G2 context is never truncated. Budgets are estimated safeguards; actual usage comes from the provider, and missing values are unknown.",
    tab: "Memory",
    guide: "Project memory, consolidation, and global profile",
    title: "Memory",
    project: "Current project",
    enabled: "On",
    disabled: "Off",
    enableProject: "Project memory",
    projectOff: "Project memory is paused. Existing entries are kept and will be available when enabled again.",
    noProject: "This session is not bound to a project yet.",
    noSession: "Choose a conversation for your memory management request.",
    refresh: "Refresh",
    loading: "Loading memory\u2026",
    unavailable: "Memory service is unavailable",
    retry: "Retry",
    accessDenied: "This connection cannot access this memory.",
    responseInvalid: "The service returned an unrecognised response.",
    sessionMismatch: "The session changed. A response for another session was ignored.",
    requestFailed: "The operation did not complete",
    close: "Close",
    more: "More",
    memories: "Library",
    activity: "Consolidation",
    issues: "Conflicts",
    profile: "User profile",
    sessions: "Include past conversations",
    settings: "Settings",
    stable: "Stable",
    active: "Active",
    history: "History",
    search: "Filter memory titles or groups",
    emptyMemories: "No memories yet",
    read: "Read",
    readFailed: "This memory could not be read.",
    current: "Current",
    archived: "Archived",
    retracted: "Retracted",
    deleted: "Deleted",
    not_found: "Not found",
    version: "Version",
    conditions: "Applies when",
    sources: "Sources",
    incompleteList: "Only part of the library is shown. Use Manage memory to find more.",
    manageMemory: "Revise this memory",
    activityIntro: "Only changes actually committed by consolidation appear here. Routine memory updates stay out of this feed.",
    emptyActivity: "No effective consolidation changes yet.",
    dream: "Consolidate now",
    dreamHint: "This calls a model for this project. Automatic runs are at least 24 hours apart, with new material and an idle project.",
    before: "Before",
    after: "After",
    reason: "Reason",
    review: "Independent review advice",
    reviewHint: "Advice refers to the candidate before submission. The final version may have changed in response.",
    contentUnavailable: "This content was not retained or has been cleared.",
    diagnostics: "Background tasks",
    emptyJobs: "No background task records.",
    job: "Task",
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    rejected: "Rejected",
    deferred: "Deferred",
    issuesIntro: "These conflicts could not be resolved from evidence. After your decision, the agent reads the latest versions before submitting changes.",
    emptyIssues: "No unresolved conflicts.",
    affected: "Related memories",
    decision: "Your decision",
    decisionPlaceholder: "Describe the correct conclusion, its conditions, or new evidence\u2026",
    submitDecision: "Send decision",
    issueSubmitted: "Your decision was sent. The issue closes only after a successful commit.",
    profileIntro: "Personal facts, preferences, and collaboration habits shared across projects. Project-specific information stays in its project.",
    profileEnabled: "Use the global profile in conversations",
    autoWrite: "Allow automatic maintenance",
    profileEmpty: "The global profile is empty.",
    editProfile: "Update the profile through conversation",
    profileChanges: "Global profile changes",
    emptyProfileChanges: "No profile changes recorded.",
    profileHint: "Update your profile directly in the conversation. Actual changes and their sources remain available in activity.",
    sessionsIntro: "Only selected past sessions enter historical consolidation. New material is included automatically after enabling memory. These selections do not delete existing memories.",
    emptySessions: "No past sessions available to include.",
    included: "Included",
    selectSession: "Include session {title}",
    includeSelected: "Include {count} selected sessions",
    selectionEmpty: "Select past sessions to include first.",
    sessionFilter: "Filter session titles",
    settingsIntro: "Models and budgets affect background cost and quality. Project memory and the global profile have independent switches.",
    models: "Models",
    g2: "Stage audit G2",
    dreamer: "Consolidation Dreamer",
    reviewer: "Independent Reviewer",
    followSession: "Leave blank to follow the originating session",
    chooseModel: "Select an explicit provider and model for this role.",
    provider: "Provider",
    model: "Model",
    noModels: "You can also enter a provider and model already configured in the host.",
    interval: "Minimum automatic interval (hours)",
    intervalHint: "At least 24 hours; no runs without new material.",
    retention: "Audit and difference retention (days)",
    retentionHint: "This period does not delete formal memory entries.",
    budgets: "Background budget",
    maxInputTokens: "Input limit per call (tokens)",
    maxOutputTokens: "Output limit per call (tokens)",
    maxSteps: "Model steps per run",
    maxDailyTokens: "Daily background limit (tokens)",
    save: "Save settings",
    invalidNumber: "Enter a valid whole number for \u201C{field}\u201D.",
    invalidModel: "Enter both provider and model. Only G2 may leave both blank to follow the originating session.",
    manage: "Manage through conversation",
    manageHint: "Your request is sent to the selected DSH conversation, using its model, permissions, and tool receipts.",
    managePlaceholder: "For example: remember a project constraint, explain a memory, revise or delete outdated information\u2026",
    send: "Send request",
    projectScope: "This project",
    userScope: "Global profile",
    nativeUnavailable: "Natural-language management is unavailable in this host.",
    textRequired: "Enter your request first.",
    receipt: "Operation receipt",
    accepted: "Accepted; awaiting processing",
    committed: "Committed",
    no_change: "No changes needed",
    cleanupPending: "The formal entry was deleted; auxiliary copies are still being cleared.",
    cleanupIncomplete: "Some copies have not been cleared. The cleanup request is incomplete.",
    requestId: "Request",
    savedSettings: "Settings saved",
    source: "Source",
    unknown: "Unknown",
    open: "Open",
    formatLocale: "en-US"
  };
  function errorText(error, t) {
    const code = error?.code;
    if (["accessDenied", "responseInvalid", "sessionMismatch", "unavailable", "nativeUnavailable", "textRequired", "selectionEmpty", "deliveryUnconfirmed"].includes(code)) return t(code);
    if (["invalidNumber", "invalidModel"].includes(code)) return t(code, error.params);
    return error?.message || (typeof error === "string" ? error : t("requestFailed"));
  }

  // src/client.js
  var { createElement: h, useState, useEffect, useRef, useCallback } = React;
  var NS = "autoMemory";
  var inject = ["slots", "locale", "layout", "uiWorkspace", "sessions", "workspaces"];
  var endpoint = "/api/dsh-automemory";
  var failure = (code, message, params) => Object.assign(new Error(message || code), { code, params });
  var serviceAvailable = true;
  var availabilityListeners = /* @__PURE__ */ new Set();
  var subscribeAvailability = (listener) => {
    availabilityListeners.add(listener);
    return () => availabilityListeners.delete(listener);
  };
  var availabilitySnapshot = () => serviceAvailable;
  function setAvailability(available) {
    if (serviceAvailable === available) return;
    serviceAvailable = available;
    for (const listener of availabilityListeners) listener();
  }
  function createAvailabilityMonitor({ request = fetch, onChange = setAvailability, intervalMs = 2e3, timers = globalThis, documentTarget = typeof document === "undefined" ? null : document, windowTarget = typeof window === "undefined" ? null : window } = {}) {
    let stopped = false, active = null;
    const check = async () => {
      if (stopped || active || documentTarget?.hidden) return;
      const controller = new AbortController();
      active = controller;
      const timeout = timers.setTimeout?.(() => {
        controller.abort();
        if (!stopped) onChange(false);
      }, 1500);
      try {
        const response = await request(`${endpoint}/status`, { method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal });
        let available = false;
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const body = await response.json();
          available = body?.ok === true && (body.data ?? body.value)?.enabled === true;
        }
        if (!stopped && !controller.signal.aborted) onChange(available);
      } catch {
        if (!stopped && !controller.signal.aborted) onChange(false);
      } finally {
        if (timeout !== void 0) timers.clearTimeout?.(timeout);
        if (active === controller) active = null;
      }
    };
    const wake = () => {
      void check();
    };
    const timer = timers.setInterval?.(wake, intervalMs);
    windowTarget?.addEventListener("focus", wake);
    documentTarget?.addEventListener("visibilitychange", wake);
    void check();
    return { check, dispose() {
      stopped = true;
      active?.abort();
      if (timer !== void 0) timers.clearInterval?.(timer);
      windowTarget?.removeEventListener("focus", wake);
      documentTarget?.removeEventListener("visibilitychange", wake);
    } };
  }
  async function decode(response) {
    if (response.status === 404) setAvailability(false);
    if (response.status === 401 || response.status === 403) throw failure("accessDenied");
    if (!response.headers.get("content-type")?.includes("application/json")) throw failure(response.status === 404 ? "unavailable" : "responseInvalid");
    let body;
    try {
      body = await response.json();
    } catch {
      throw failure("responseInvalid");
    }
    if (!response.ok || body?.ok !== true) {
      const error = body?.error;
      throw failure(error?.code || body?.errorKey || "requestFailed", typeof error === "string" ? error : error?.message);
    }
    const data = body.data ?? body.value;
    if (!data || typeof data !== "object") throw failure("responseInvalid");
    setAvailability(true);
    return data;
  }
  async function catalogRequest(signal) {
    return decode(await fetch(endpoint + "/catalog", { credentials: "same-origin", cache: "no-store", signal }));
  }
  async function apiRequest(scope, action, params = {}, signal) {
    const target = typeof scope === "string" ? { sessionId: scope } : scope || {};
    const identity = {};
    if (target.workspaceId) identity.workspaceId = target.workspaceId;
    if (target.sessionId) identity.sessionId = target.sessionId;
    if (action && !Object.keys(identity).length && !["settings-save", "user-profile-toggle", "manager-open", "manager-state", "manager-send", "manager-close", "manager-confirm"].includes(action)) throw failure("noSession");
    const url = action ? endpoint + "/action" : Object.keys(identity).length ? endpoint + "/state?" + new URLSearchParams(identity) : endpoint + "/global";
    const clean = { ...params };
    delete clean.sessionId;
    delete clean.workspaceId;
    delete clean.action;
    const response = await fetch(url, {
      method: action ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      ...action ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ ...clean, ...identity, action }) } : {}
    });
    const data = await decode(response);
    if (data.sessionId && identity.sessionId && data.sessionId !== identity.sessionId) throw failure("sessionMismatch");
    if (identity.workspaceId && (data.workspace?.id || data.workspaceId) && (data.workspace?.id || data.workspaceId) !== identity.workspaceId) throw failure("sessionMismatch");
    return data;
  }
  function receiptPresentation(value) {
    const receipt = value?.receipt || value || {};
    const status = receipt.status || "unknown";
    const cleanup = receipt.cleanup_status ?? receipt.cleanupStatus;
    const tone = ["failed", "rejected", "cancelled"].includes(status) ? "error" : ["accepted", "queued", "running"].includes(status) || ["pending", "incomplete"].includes(cleanup) ? "warning" : status === "committed" ? "success" : "neutral";
    return { status, tone, cleanup, message: receipt.message, requestId: receipt.request_id ?? receipt.requestId, jobId: receipt.job_id ?? receipt.jobId, scope: receipt.scope_statement ?? receipt.scopeStatement, errors: receipt.errors || [], results: receipt.results || [] };
  }
  function visibleDreamActivity(items = []) {
    return items.filter((item) => String(item.channel || "").toUpperCase() === "DREAMING" && item.status === "committed" && item.changed === true);
  }
  function jobPresentation(job, t) {
    const waiting = ["queued", "paused"].includes(job.status) && !!job.deferral;
    return {
      waiting,
      label: waiting ? t("waitingModel") : statusLabel(job.status, t),
      message: waiting ? t("modelWaitHint") : job.error ? job.userMessage || t("consolidationFailed") : null
    };
  }
  function usagePresentation(usage, t) {
    const format = new Intl.NumberFormat(t("formatLocale"), { maximumFractionDigits: 8 });
    return [["calls", "usageCalls"], ["totalTokens", "usageTotal"], ["cacheReadTokens", "usageCacheRead"], ["cost", "usageCost"]].map(([key, label]) => {
      const value = usage?.[key];
      return { key, label: t(label), value: typeof value === "number" && Number.isFinite(value) && value >= 0 ? format.format(value) : t("unknown") };
    });
  }
  function normaliseSettings(input) {
    const number = (value, field, min, max) => {
      const n = typeof value === "number" ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
      if (!Number.isSafeInteger(n) || n < min || n > max) throw failure("invalidNumber", null, { field });
      return n;
    };
    const models = {};
    for (const role of ["g2", "dreamer", "reviewer", ...input.models?.manager ? ["manager"] : []]) {
      const provider = String(input.models?.[role]?.provider || "").trim();
      const model = String(input.models?.[role]?.model || "").trim();
      if (Boolean(provider) !== Boolean(model) || role !== "g2" && !provider) throw failure("invalidModel");
      models[role] = provider ? { provider, model, ...input.models?.[role]?.reasoningEffort ? { reasoningEffort: input.models[role].reasoningEffort } : {} } : null;
    }
    return {
      ...input.revision !== void 0 ? { revision: input.revision } : {},
      models,
      dreamIntervalHours: number(input.dreamIntervalHours, "interval", 24, 8760),
      auditRetentionDays: number(input.auditRetentionDays, "retention", 1, 3650),
      budget: {
        maxInputTokens: number(input.budget?.maxInputTokens, "maxInputTokens", 1024, 2e6),
        maxOutputTokens: number(input.budget?.maxOutputTokens, "maxOutputTokens", 128, 32768),
        maxSteps: number(input.budget?.maxSteps, "maxSteps", 1, 32),
        maxDailyTokens: number(input.budget?.maxDailyTokens, "maxDailyTokens", 1024, 1e8)
      }
    };
  }
  function Icon({ name = "memory", size = 18 } = {}) {
    const paths = {
      memory: "M7 3.5h10a2 2 0 0 1 2 2v15l-7-3-7 3v-15a2 2 0 0 1 2-2Z M9 8h6 M9 11.5h4",
      search: "M10.5 3.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4.5 4.5",
      close: "m6 6 12 12M6 18 18 6",
      refresh: "M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 19.7 10M4.3 14A8 8 0 0 0 17.9 17.9",
      settings: "M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M10 14v6",
      folder: "M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z",
      arrow: "M19 12H5m6-6-6 6 6 6",
      plus: "M12 5v14M5 12h14",
      globe: "M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM3 12h18M12 3c4 4 4 14 0 18-4-4-4-14 0-18Z",
      history: "M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2",
      check: "m5 12 4 4L19 6",
      chat: "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z",
      arrowOut: "M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"
    };
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true }, h("path", { d: paths[name] || paths.memory, stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round", strokeLinejoin: "round" }));
  }
  var asText = (value) => typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);
  var previewText = (value) => asText(value).replace(/^#{1,6}\s+/gm, "").replace(/\*\*|__/g, "").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
  var entry = (memory) => ({ ...memory, ...memory.content || {} });
  var date = (value, t) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString(t("formatLocale"), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  var statusLabel = (status, t) => Object.hasOwn(zh, status) ? t(status) : String(status || t("unknown"));
  function Markdown({ text, t }) {
    if (typeof NativeMarkdown === "undefined" || asText(text).includes("![")) return h("div", { className: "dam-prose dam-plain-text" }, text);
    return h("div", { className: "dam-prose" }, h(NativeMarkdown, { text: asText(text), labels: { code: { copyLabel: t("copy"), copiedLabel: t("copied"), toolbarLabels: { codeLabel: t("code"), wrapLabel: t("wrap"), unwrapLabel: t("unwrap") } }, footnotes: t("footnotes") } }));
  }
  function Empty({ icon = "memory", title, description, children }) {
    return h("div", { className: "dam-empty-state" }, h("span", { className: "dam-empty-icon" }, h(Icon, { name: icon, size: 28 })), h("h3", null, title), description ? h("p", null, description) : null, children);
  }
  function Sources({ refs = [], t }) {
    if (!refs.length) return null;
    return h("details", { className: "dam-disclosure" }, h("summary", null, t("sources"), h("span", { className: "dam-count" }, refs.length)), h("ul", { className: "dam-sources" }, ...refs.map((ref, i) => {
      const label = typeof ref === "string" ? ref : ref.locator || ref.path || ref.sessionId || asText(ref);
      return h("li", { key: i }, /^https?:\/\//i.test(label) ? h("a", { href: label, target: "_blank", rel: "noreferrer noopener" }, label) : label);
    })));
  }
  function Receipt({ value, t, onClose, openSession }) {
    if (!value) return null;
    const r = receiptPresentation(value);
    return h(
      "section",
      { className: "dam-notice", "data-tone": r.tone, role: r.tone === "error" ? "alert" : "status", "aria-live": "polite" },
      h("div", { className: "dam-row" }, h("strong", null, statusLabel(r.status, t)), h("button", { className: "dam-icon", onClick: onClose, "aria-label": t("close") }, h(Icon, { name: "close", size: 16 }))),
      r.cleanup === "incomplete" || r.cleanup === "pending" ? h("p", null, t(r.cleanup === "incomplete" ? "cleanupIncomplete" : "cleanupPending")) : null,
      h("details", { className: "dam-disclosure" }, h("summary", null, t("viewDetails")), r.message ? h("p", null, r.message) : null, r.scope ? h("p", null, r.scope) : null, r.requestId ? h("p", { className: "dam-mono" }, r.requestId) : null, r.jobId ? h("p", { className: "dam-mono" }, r.jobId) : null),
      ...r.errors.map((error, i) => h("p", { key: i }, errorText(error, t)))
    );
  }
  function filterMemories(items = [], category = "all", query = "") {
    const term = query.trim().toLocaleLowerCase();
    return items.map(entry).filter((m) => (category === "history" ? m.status !== "current" : m.status === "current" && (category === "all" || m.category === category)) && (!term || [m.title, m.group, m.index_hint].join(" ").toLocaleLowerCase().includes(term))).sort((a, b) => (a.category === b.category ? 0 : a.category === "active" ? -1 : 1) || Number(b.updated_at) - Number(a.updated_at) || String(a.title).localeCompare(String(b.title)));
  }
  function MemoryContent({ record, fallback, t }) {
    const c = record?.content, payload = c?.payload;
    if (!c) return h(Markdown, { text: fallback || t("readFailed"), t });
    return h(
      React.Fragment,
      null,
      c.conditions ? h("section", { className: "dam-conditions" }, h("h3", null, t("conditions")), h("p", null, c.conditions)) : null,
      payload?.kind === "markdown" ? h(Markdown, { text: payload.text, t }) : payload ? h("div", { className: "dam-task-content" }, h(Markdown, { text: payload.goal, t }), ...["progress", "blockers", "next_actions"].map((key) => payload[key]?.length ? h("section", { key }, h("h3", null, t(key)), h("ul", null, ...payload[key].map((value, i) => h("li", { key: i }, value)))) : null), h(Sources, { refs: payload.references, t })) : null
    );
  }
  function Change({ item, t, showReview = false }) {
    const before = item.before ?? item.diff?.before, after = item.after ?? item.diff?.after;
    return h("article", { className: "dam-change" }, h("div", { className: "dam-change-marker" }, h(Icon, { name: "check", size: 15 })), h(
      "div",
      { className: "dam-change-content" },
      h("div", { className: "dam-row" }, h("h3", null, item.summary || item.reason || item.message || t("committed")), h("time", null, date(item.time ?? item.created_at ?? item.createdAt, t))),
      item.summary && item.reason ? h("p", { className: "dam-hint" }, item.reason) : null,
      before != null || after != null ? h("details", { className: "dam-disclosure" }, h("summary", null, t("viewChanges")), h("div", { className: "dam-diff" }, h("div", null, h("h4", null, t("before")), h(Markdown, { text: asText(before), t })), h("div", null, h("h4", null, t("after")), h(Markdown, { text: asText(after), t })))) : null,
      h(Sources, { refs: item.source_refs || item.sources || [], t }),
      showReview && item.review ? h("details", { className: "dam-disclosure" }, h("summary", null, t("review")), h("p", { className: "dam-hint" }, t("reviewHint")), h("pre", { className: "dam-body" }, asText(item.review))) : null
    ));
  }
  function historySessionBlank(item, native) {
    const projected = native?.projectionValues?.sessionListMetadata?.blank;
    if (native?.running === true || projected === false || item.blankKnown === true && item.blank === false) return false;
    if (item.blankKnown === true) return typeof item.blank === "boolean" ? item.blank : void 0;
    if (item.blankKnown === false) return void 0;
    if (typeof projected === "boolean") return projected;
    return typeof native?.blank === "boolean" ? native.blank : item.blank;
  }
  function historySessionGroups(items = [], nativeSessions = {}, t, filter = "") {
    const sessions = [], seen = /* @__PURE__ */ new Set();
    const identifierTitle = (value) => /^(?:session-)?[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      const native = nativeSessions[item.id];
      const blank = historySessionBlank(item, native);
      if (blank === true) continue;
      const cwdName = typeof native?.cwd === "string" ? native.cwd.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) : null;
      const displayTitle = typeof native?.displayTitle === "string" && native.displayTitle.trim() !== cwdName ? native.displayTitle : null;
      const candidates = [native?.title, native?.projectionValues?.title, item.title, displayTitle].filter((value) => typeof value === "string").map((value) => value.trim());
      const savedTitle = candidates.find((value) => value && value !== item.id && !identifierTitle(value));
      const updatedAt = native?.updatedAt || item.updatedAt || item.createdAt;
      const when = date(updatedAt, t);
      const title = savedTitle || t("untitledConversation") + (when ? " \xB7 " + when : "");
      sessions.push({ ...item, title, titleIsFallback: !savedTitle, updatedAt, blank, included: item.included === true });
    }
    const term = filter.trim().toLocaleLowerCase();
    const visible = sessions.filter((session) => !term || session.title.toLocaleLowerCase().includes(term));
    return { sessions, selectable: visible.filter((session) => !session.included), covered: visible.filter((session) => session.included) };
  }
  async function includeHistorySelection({ sessionIds, act, isCurrent, onViewStateChange }) {
    const submitted = [...sessionIds];
    const result = await act("include-sessions", { sessionIds: submitted });
    if (result && isCurrent()) onViewStateChange((current) => ({ ...current, selectedIds: (current.selectedIds || []).filter((id) => !submitted.includes(id)) }));
    return result;
  }
  function PastSessions({ data, nativeSessions, act, busy, t, viewState = {}, onViewStateChange }) {
    const mounted = useRef(false);
    useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);
    const selected = new Set(viewState.selectedIds || []), filter = viewState.filter || "";
    const groups = historySessionGroups(data.sessions || [], nativeSessions, t, filter);
    const selectedIds = groups.sessions.filter((session) => selected.has(session.id) && !session.included).map((session) => session.id);
    const change = (patch) => onViewStateChange((current) => ({ ...current, ...typeof patch === "function" ? patch(current) : patch }));
    const caption = (session) => h("span", null, h("strong", null, session.title), !session.titleIsFallback && date(session.updatedAt, t) ? h("span", { className: "dam-muted" }, date(session.updatedAt, t)) : null);
    return h(
      "div",
      { className: "dam-history-picker" },
      h("div", { className: "dam-search" }, h(Icon, { name: "search", size: 16 }), h("input", { type: "search", value: filter, placeholder: t("sessionFilter"), "aria-label": t("sessionFilter"), onChange: (event) => change({ filter: event.target.value }) })),
      data.capabilities?.includeSessions === false && groups.sessions.some((session) => !session.included) ? h("p", { className: "dam-inline-status", role: "status" }, t("historyPausedHint")) : null,
      groups.selectable.length ? h("section", { className: "dam-history-group", "aria-label": t("historySelectable") }, h("div", { className: "dam-row" }, h("h4", null, t("historySelectable")), h("span", { className: "dam-muted" }, t("sessionCount", { count: groups.selectable.length }))), h("div", { className: "dam-list" }, ...groups.selectable.map((session) => h("label", { key: session.id, className: "dam-session-choice" }, h("input", { type: "checkbox", checked: selected.has(session.id), disabled: busy || data.capabilities?.includeSessions === false, "aria-label": t("selectSession", { title: session.title }), onChange: (event) => {
        const checked = event.target.checked;
        change((current) => {
          const next = new Set(current.selectedIds || []);
          checked ? next.add(session.id) : next.delete(session.id);
          return { selectedIds: [...next] };
        });
      } }), caption(session))))) : null,
      groups.covered.length ? h("section", { className: "dam-history-group dam-history-covered", "aria-label": t("historyCovered") }, h("div", { className: "dam-row" }, h("h4", null, t("historyCovered")), h("span", { className: "dam-muted" }, t("sessionCount", { count: groups.covered.length }))), h("p", { className: "dam-hint" }, t("historyCoveredHint")), h("div", { className: "dam-list" }, ...groups.covered.map((session) => h("article", { key: session.id, className: "dam-covered-session" }, h(Icon, { name: "check", size: 17 }), caption(session), h("span", { className: "dam-badge" }, t("included")))))) : null,
      !groups.selectable.length && !groups.covered.length ? h(Empty, { icon: "chat", title: filter ? t("noMatchingSessions") : t("emptySessions") }) : null,
      groups.sessions.some((session) => !session.included) ? h("div", { className: "dam-settings-actions" }, h("span", { className: "dam-muted" }, t("selectedCount", { count: selectedIds.length })), h("button", { className: "dam-button primary", disabled: busy || !selectedIds.length || data.capabilities?.includeSessions === false, onClick: () => includeHistorySelection({ sessionIds: selectedIds, act, isCurrent: () => mounted.current, onViewStateChange }) }, t("includeSelected", { count: selectedIds.length }))) : null
    );
  }
  function Settings({ data, act, busy, t }) {
    const [form, setForm] = useState(data.settings || {}), [dirty, setDirty] = useState(false), [error, setError] = useState(null);
    useEffect(() => {
      if (!dirty) setForm(data.settings || {});
    }, [data.settings, dirty]);
    const change = (key, value) => {
      setDirty(true);
      setError(null);
      setForm((old) => ({ ...old, [key]: value }));
    };
    const modelChange = (role, key, value) => change("models", { ...form.models, [role]: { ...form.models?.[role], [key]: value } });
    const modelFields = (role) => ["provider", "model"].map((key) => {
      const choices = [...new Set((data.models || []).filter((m) => key === "provider" || !form.models?.[role]?.provider || m.provider === form.models[role].provider).map((m) => m[key]))];
      return h("label", { className: "dam-field", key }, h("span", null, t(key)), h("input", { value: form.models?.[role]?.[key] || "", required: role !== "g2", list: "dam-" + role + "-" + key, onChange: (e) => modelChange(role, key, e.target.value), autoComplete: "off" }), h("datalist", { id: "dam-" + role + "-" + key }, ...choices.map((value) => h("option", { key: value, value }))));
    });
    const number = (key, min, max, budget = false) => h("label", { className: "dam-field", key }, h("span", null, t(key)), h("input", { type: "number", min, max, required: true, value: (budget ? form.budget?.[key] : form[key]) ?? "", onChange: (e) => budget ? change("budget", { ...form.budget, [key]: e.target.value }) : change(key, e.target.value) }));
    return h(
      "form",
      { className: "dam-section dam-secondary-panel dam-settings", onSubmit: async (e) => {
        e.preventDefault();
        setError(null);
        try {
          const result = await act("settings-save", { settings: normaliseSettings(form) });
          if (result) setDirty(false);
        } catch (err) {
          if (err.params?.field) err.params.field = t(err.params.field);
          setError(err);
        }
      } },
      h("div", { className: "dam-section-head" }, h("div", null, h("h2", null, t("settings")), h("p", { className: "dam-hint" }, t("settingsIntro")))),
      h("fieldset", { className: "dam-fieldset", disabled: busy }, h("legend", null, t("generalSettings")), h("div", { className: "dam-fields" }, h("div", null, number("dreamIntervalHours", 24, 8760), h("p", { className: "dam-hint" }, t("intervalHint"))), h("div", null, number("auditRetentionDays", 1, 3650), h("p", { className: "dam-hint" }, t("retentionHint"))))),
      h("fieldset", { className: "dam-fieldset", disabled: busy }, h("legend", null, t("models")), h("p", { className: "dam-hint" }, t("modelsHint")), ...["manager", "g2", "dreamer", "reviewer"].map((role) => h("div", { key: role, className: "dam-model-row" }, h("div", null, h("strong", null, t(role)), h("p", { className: "dam-hint" }, t(role === "g2" ? "followSession" : "chooseModel"))), h("div", { className: "dam-fields" }, ...modelFields(role))))),
      h("details", { className: "dam-disclosure dam-advanced" }, h("summary", null, t("advanced")), h("fieldset", { className: "dam-fieldset", disabled: busy }, h("legend", null, t("budgets")), h("p", { className: "dam-hint" }, t("budgetEstimateHint")), h("div", { className: "dam-fields" }, number("maxInputTokens", 1024, 2e6, true), number("maxOutputTokens", 128, 32768, true), number("maxSteps", 1, 32, true), number("maxDailyTokens", 1024, 1e8, true)))),
      error ? h("p", { className: "dam-error", role: "alert" }, errorText(error, t)) : null,
      h("div", { className: "dam-settings-actions" }, h("button", { type: "submit", className: "dam-button primary", disabled: busy || !dirty }, t("save")))
    );
  }
  function createManagerChannel({ request, onChange, timers = globalThis, pollMs = 900, newId = () => crypto.randomUUID() }) {
    let closed = false, timer, conversation, opening, reading = false, delivery = null, retryId = null;
    const receive = (value) => {
      const next = value?.conversation || value;
      const id = next?.id || next?.conversationId;
      if (!id || conversation && id !== conversation.id) throw failure("sessionMismatch");
      conversation = { ...next, id };
      if (delivery && next.diagnostics?.requestId?.endsWith(":" + delivery.requestId)) delivery.acknowledged = true;
      if (retryId && next.diagnostics?.requestId?.endsWith(":" + retryId)) retryId = null;
      if (!closed) onChange(conversation);
      return conversation;
    };
    const refresh = async () => {
      if (closed || !conversation || reading) return;
      reading = true;
      try {
        receive(await request("manager-state", { conversationId: conversation.id }));
      } catch (error) {
        if (!closed) onChange({ ...conversation, connectionError: error });
      } finally {
        reading = false;
      }
    };
    const start = () => {
      if (opening) return opening;
      opening = request("manager-open", { requestId: newId() }).then(async (value) => {
        receive(value);
        if (closed) {
          await request("manager-close", { conversationId: conversation.id }).catch(() => {
          });
          return;
        }
        timer = timers.setInterval(() => {
          if (["running", "queued", "working"].includes(conversation?.status)) void refresh();
        }, pollMs);
        return conversation;
      }).catch((error) => {
        opening = null;
        if (!closed) onChange({ error, status: "error", messages: [] });
      });
      return opening;
    };
    return {
      start,
      refresh,
      async send(text, context = {}) {
        if (closed || !conversation) throw failure("unavailable");
        const payload = JSON.stringify({ text, context });
        if (delivery && delivery.payload !== payload) {
          if (!delivery.acknowledged) throw failure("deliveryUnconfirmed");
          delivery = null;
        }
        delivery ||= { payload, requestId: newId() };
        const value = await request("manager-send", { ...context, conversationId: conversation.id, text, requestId: delivery.requestId });
        delivery = null;
        if (!closed) receive(value);
        return value;
      },
      async retry() {
        if (closed || !conversation) throw failure("unavailable");
        retryId ||= newId();
        const value = await request("manager-retry", { conversationId: conversation.id, requestId: retryId });
        retryId = null;
        if (!closed) receive(value);
        return value;
      },
      async confirm(confirmationId, approved) {
        if (closed || !conversation) throw failure("unavailable");
        const value = await request("manager-confirm", { conversationId: conversation.id, confirmationId, approved });
        if (!closed) receive(value);
        return value;
      },
      dispose() {
        if (closed) return;
        closed = true;
        if (timer !== void 0) timers.clearInterval(timer);
        if (conversation) void request("manager-close", { conversationId: conversation.id }).catch(() => {
        });
      }
    };
  }
  function workspaceProjects(projects, snapshot) {
    if (!snapshot) return projects;
    return snapshot.map((w) => {
      const project = projects.find((p) => p.nativeWorkspaceId === w.workspaceId);
      return project ? {
        ...project,
        key: w.workspaceId,
        name: w.title,
        path: w.path,
        sessions: (project.sessions || []).filter((s) => w.sessionIds.includes(s.id))
      } : { key: w.workspaceId, nativeWorkspaceId: w.workspaceId, id: null, name: w.title, path: w.path, canBrowse: false, sessions: [] };
    });
  }
  function visibleMemoryActivity(items = []) {
    return items.filter((item) => item.status === "committed" && item.changed === true && (item.before != null || item.after != null || item.diff || ["overview.organized", "issue.resolved"].includes(item.event_type)));
  }
  function Loading({ t }) {
    return h("div", { className: "dam-loading", role: "status" }, h("span", { className: "dam-spinner" }), t("loading"));
  }
  function ErrorNotice({ error, retry, t }) {
    return error ? h("div", { className: "dam-error", role: "alert" }, h("p", null, errorText(error, t)), retry ? h("button", { className: "dam-button", onClick: retry }, t("refreshStatus")) : null) : null;
  }
  function managerRetryLabel(mode) {
    return mode === "review" ? "reviewResult" : "resendRequest";
  }
  function managerErrorMessage(error, t) {
    if (!error?.requestId) return errorText(error, t);
    const keys = { AUTH: "managerAuthError", RATE_LIMIT: "managerRateLimitError", MODEL_BUDGET_EXCEEDED: "managerBudgetError", MODEL_INPUT_BUDGET: "managerContextError", MANAGEMENT_TIMEOUT: "managerTimeoutError", MANAGEMENT_STEP_LIMIT: "managerStepError" };
    return t(keys[error.code] || "managerFailure");
  }
  function ManagerFailure({ error, diagnostics, retry, onRefresh, onRetry, disabled, t }) {
    if (!error) return null;
    return h(
      "section",
      { className: "dam-error", role: "alert" },
      h("p", null, managerErrorMessage(error, t)),
      diagnostics?.writes === "committed" ? h("p", null, t("managerWritesCommitted")) : diagnostics?.writes === "uncertain" ? h("p", null, t("managerWritesUncertain")) : null,
      h("div", { className: "dam-header-actions" }, h("button", { className: "dam-button", disabled, onClick: onRefresh }, t("refreshStatus")), retry ? h("button", { className: "dam-button", disabled, onClick: onRetry }, t(managerRetryLabel(retry.mode))) : null),
      diagnostics ? h(
        "details",
        { className: "dam-disclosure" },
        h("summary", null, t("failureDetails")),
        h("dl", { className: "dam-metadata" }, h("dt", null, t("failureCode")), h("dd", null, diagnostics.error?.code || error.code || t("unknown")), h("dt", null, t("failureStage")), h("dd", null, t("managerStage_" + (diagnostics.error?.stage || diagnostics.stage || "prepare"))), h("dt", null, t("model")), h("dd", null, [diagnostics.provider, diagnostics.model].filter(Boolean).join(" / ") || t("unknown")), h("dt", null, t("requestId")), h("dd", null, diagnostics.requestId), diagnostics.error?.httpStatus ? h(React.Fragment, null, h("dt", null, "HTTP"), h("dd", null, diagnostics.error.httpStatus)) : null),
        (diagnostics.calls || []).length ? h("ol", null, ...diagnostics.calls.map((item, index) => h("li", { key: index }, [item.step ? t("managerStep", { step: item.step }) : "", item.tool || t("managerModelCall"), item.kind === "model-finish" ? item.finish : item.status || "", item.code || ""].filter(Boolean).join(" \xB7 ")))) : null
      ) : null
    );
  }
  function useMemoryState(workspaceId) {
    const [data, setData] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false), [receipt, setReceipt] = useState(null);
    const mounted = useRef(false), pending = useRef(null), generation = useRef(0);
    const refresh = useCallback(async () => {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      const seq = ++generation.current;
      try {
        const value = await apiRequest(workspaceId ? { workspaceId } : null, null, {}, controller.signal);
        if (mounted.current && !controller.signal.aborted && seq === generation.current) {
          setData(value);
          setError(null);
        }
      } catch (error2) {
        if (mounted.current && !controller.signal.aborted) setError(error2);
      }
    }, [workspaceId]);
    useEffect(() => {
      mounted.current = true;
      void refresh();
      const wake = () => {
        if (!document.hidden) void refresh();
      };
      const timer = setInterval(wake, 15e3);
      window.addEventListener("focus", wake);
      document.addEventListener("visibilitychange", wake);
      return () => {
        mounted.current = false;
        pending.current?.abort();
        clearInterval(timer);
        window.removeEventListener("focus", wake);
        document.removeEventListener("visibilitychange", wake);
      };
    }, [refresh]);
    const act = async (action, params = {}, options = {}) => {
      setBusy(true);
      setError(null);
      try {
        const value = await apiRequest(options.scope ?? (workspaceId ? { workspaceId } : null), action, params);
        if (mounted.current) {
          if (options.receipt !== false) setReceipt(value);
          if (options.refresh !== false) await refresh();
        }
        return value;
      } catch (err) {
        if (mounted.current) setError(err);
        if (options.receipt === false) throw err;
        return null;
      } finally {
        if (mounted.current) setBusy(false);
      }
    };
    return { data, error, busy, act, refresh, receipt, clearReceipt: () => setReceipt(null) };
  }
  function ManagerChat({ workspaceId, nativeWorkspaceId, userScope, context, contextLabel, t, onUpdated, focusRequest }) {
    const [conversation, setConversation] = useState(null), [text, setText] = useState(""), [sending, setSending] = useState(false), [error, setError] = useState(null);
    const channel = useRef(null), field = useRef(null), chatLog = useRef(null), updated = useRef(onUpdated), previous = useRef("");
    updated.current = onUpdated;
    useEffect(() => {
      const connection = createManagerChannel({
        request: (action, params) => apiRequest(workspaceId ? { workspaceId } : null, action, { ...params, scope: userScope ? "user" : "project", ...action === "manager-open" && !userScope && nativeWorkspaceId ? { nativeWorkspaceId } : {} }),
        onChange: (next) => {
          setConversation(next);
          const signature = JSON.stringify([next.status, next.messages?.length, next.revision, next.updatedAt]);
          if (previous.current && signature !== previous.current && !["running", "queued"].includes(next.status)) void updated.current?.();
          previous.current = signature;
        }
      });
      channel.current = connection;
      void connection.start();
      return () => {
        channel.current = null;
        connection.dispose();
      };
    }, [workspaceId, nativeWorkspaceId, userScope]);
    useEffect(() => {
      if (focusRequest) field.current?.focus();
    }, [focusRequest]);
    const messages = conversation?.messages || [];
    useEffect(() => {
      if (messages.length && chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
    }, [messages.length, conversation?.status]);
    const pending = sending || ["running", "queued", "working"].includes(conversation?.status);
    const confirmation = conversation?.confirmation || conversation?.pendingConfirmation;
    const send = async (e) => {
      e.preventDefault();
      if (!text.trim() || pending || !conversation?.id || confirmation) return;
      setSending(true);
      setError(null);
      try {
        await channel.current.send(text.trim(), context || {});
        setText("");
      } catch (err) {
        setError(err);
      } finally {
        setSending(false);
      }
    };
    return h(
      "aside",
      { className: "dam-manager", "aria-label": t("managerTitle") },
      h("header", { className: "dam-manager-header" }, h(Icon, { name: "chat", size: 19 }), h("div", null, h("h2", null, t("managerTitle")), h("p", null, t("managerSubtitle")))),
      h(
        "div",
        { ref: chatLog, className: "dam-chat-log", role: "log", "aria-live": "polite", "aria-label": t("managerMessages") },
        !messages.length ? h(
          "div",
          { className: "dam-chat-welcome" },
          h(Icon, { name: "memory", size: 27 }),
          h("h3", null, t("managerWelcome")),
          h("p", null, t(userScope ? "managerWelcomeUser" : "managerWelcomeProject")),
          h("div", { className: "dam-chat-suggestions" }, ...(userScope ? ["profileSuggestion"] : ["explainSuggestion", "organizeSuggestion"]).map((key) => h("button", { key, className: "dam-button", onClick: () => {
            setText(t(key));
            field.current?.focus();
          } }, t(key))))
        ) : null,
        ...messages.filter((message) => ["user", "assistant"].includes(message.role)).map((message, i) => h("article", { key: message.id || i, className: "dam-chat-message", "data-role": message.role }, h("span", { className: "dam-sr-only" }, t(message.role === "user" ? "you" : "memoryAssistant")), h(Markdown, { text: message.text || message.content?.filter?.((x) => x.type === "text").map((x) => x.text).join("\n") || "", t }), message.status === "failed" ? h("span", { className: "dam-muted" }, t("failed")) : null)),
        pending ? h("div", { className: "dam-chat-progress", role: "status" }, h("span", { className: "dam-spinner" }), t("managerWorking")) : null,
        confirmation ? h("section", { className: "dam-chat-confirm" }, h("strong", null, t("confirmMemoryChange")), h("p", null, confirmation.message || confirmation.description || t("confirmMemoryChangeHint")), h("div", { className: "dam-header-actions" }, ...[[false, "cancel"], [true, "confirmAction"]].map(([approved, label]) => h("button", { key: label, className: "dam-button" + (approved ? " primary" : ""), disabled: sending, onClick: async () => {
          setSending(true);
          try {
            await channel.current.confirm(confirmation.id || confirmation.confirmationId, approved);
          } catch (err) {
            setError(err);
          } finally {
            setSending(false);
          }
        } }, t(label))))) : null,
        h(ManagerFailure, { error: error || conversation?.connectionError || conversation?.error, diagnostics: conversation?.diagnostics, retry: !confirmation ? conversation?.retry : null, disabled: pending, onRefresh: () => {
          setError(null);
          return conversation?.id ? channel.current?.refresh() : channel.current?.start();
        }, onRetry: async () => {
          if (pending || confirmation) return;
          setSending(true);
          setError(null);
          try {
            await updated.current?.();
            await channel.current?.retry();
          } catch (err) {
            setError(err);
          } finally {
            setSending(false);
          }
        }, t })
      ),
      h(
        "form",
        { className: "dam-chat-composer", onSubmit: send },
        h("div", { className: "dam-chat-scope" }, h(Icon, { name: context?.issueId ? "chat" : "folder", size: 14 }), h("span", null, contextLabel)),
        h("textarea", { ref: field, rows: 3, value: text, onChange: (e) => setText(e.target.value), placeholder: t(userScope ? "profileChatPlaceholder" : "managerPlaceholder"), "aria-label": t("managerInput"), disabled: !conversation?.id || sending, onKeyDown: (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(e);
        } }),
        h("div", { className: "dam-chat-send-row" }, h("span", { className: "dam-muted" }, t("managerScopeHint")), h("button", { type: "submit", className: "dam-button primary", disabled: !text.trim() || pending || !conversation?.id || !!confirmation }, t("send")))
      )
    );
  }
  function MemoryRecord({ memory, act, t, onDiscuss }) {
    const [open, setOpen] = useState(false), [loaded, setLoaded] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(false);
    const generation = useRef(0);
    useEffect(() => {
      generation.current++;
      setLoaded(null);
      setOpen(false);
    }, [memory.id, memory.version]);
    useEffect(() => () => {
      generation.current++;
    }, []);
    const read = async () => {
      setOpen((value) => !value);
      if (open || loaded) return;
      const seq = ++generation.current;
      setLoading(true);
      setError(null);
      try {
        const result = await act("read", { ids: [memory.id], include_noncurrent: true }, { receipt: false, refresh: false });
        if (seq === generation.current) setLoaded(result.items?.[0]);
      } catch (error2) {
        if (seq === generation.current) setError(error2);
      } finally {
        if (seq === generation.current) setLoading(false);
      }
    };
    const m = entry(memory), record = loaded?.record;
    return h(
      "article",
      { className: "dam-record", "data-expanded": open },
      h("button", { className: "dam-record-head", onClick: read, "aria-expanded": open }, h("span", null, h("strong", null, m.title || t("untitledMemory")), m.index_hint ? h("span", { className: "dam-muted" }, m.index_hint) : null), h("span", { className: "dam-record-chevron", "aria-hidden": true }, "\u203A")),
      open ? h("div", { className: "dam-record-body" }, loading ? h(Loading, { t }) : null, h(ErrorNotice, { error, t }), loaded ? h(React.Fragment, null, memory.status !== "current" ? h("p", { className: "dam-muted" }, statusLabel(memory.status, t), " \xB7 ", t("historyHint")) : null, h(MemoryContent, { record, fallback: loaded.markdown, t }), h("footer", { className: "dam-record-footer" }, h("button", { className: "dam-button", onClick: () => onDiscuss({ memoryId: memory.id, label: m.title }) }, h(Icon, { name: "chat", size: 15 }), t("discussMemory")), h(Sources, { refs: record?.source_refs, t })), h("details", { className: "dam-disclosure" }, h("summary", null, t("details")), h("dl", { className: "dam-metadata" }, h("dt", null, t("version")), h("dd", null, record?.version || memory.version), h("dt", null, t("lastUpdated")), h("dd", null, date(record?.updated_at || memory.updated_at, t)), h("dt", null, "ID"), h("dd", { className: "dam-mono" }, memory.id)))) : null) : null
    );
  }
  function Overview({ data, selected, onSelect, onDiscuss, act, t }) {
    const [query, setQuery] = useState(""), [showAll, setShowAll] = useState(false), [category, setCategory] = useState("all");
    const overview = data.overview || {}, topics = overview.topics || [], issues = (data.issues || []).filter((x) => x.status !== "resolved");
    const topic = selected?.topicId ? topics.find((x) => x.id === selected.topicId) : null;
    const issue = selected?.issueId ? issues.find((x) => x.id === selected.issueId) : null;
    const current = (data.memories || []).filter((x) => x.status === "current");
    const relevant = topic ? (data.memories || []).filter((m) => topic.memoryIds?.includes(m.id)) : data.memories || [];
    const filtered = filterMemories(relevant, category, query);
    return h(
      "section",
      { className: "dam-overview" },
      topic || issue || showAll ? h("button", { className: "dam-button dam-overview-back", onClick: () => {
        onSelect(null);
        setShowAll(false);
        setQuery("");
        setCategory("all");
      } }, h(Icon, { name: "arrow", size: 15 }), t("projectOverview")) : null,
      issue ? h("article", { className: "dam-issue-detail" }, h("p", { className: "dam-eyebrow" }, t("needsDecision")), h("h2", null, issue.question || issue.title || t("needsDecision")), issue.context ? h(Markdown, { text: asText(issue.context), t }) : null, h(Sources, { refs: issue.source_refs || issue.sources, t }), h("p", { className: "dam-hint" }, t("issueChatHint")), h("button", { className: "dam-button", onClick: () => onDiscuss({ issueId: issue.id, label: issue.question || issue.title }) }, h(Icon, { name: "chat", size: 16 }), t("discussIssue"))) : h(
        React.Fragment,
        null,
        h("div", { className: "dam-overview-heading" }, h("p", { className: "dam-eyebrow" }, t(topic ? "topicMemory" : showAll ? "allMemories" : "projectOverview")), h("h2", null, topic?.title || (showAll ? t("allMemories") : t("overviewTitle"))), h("p", { className: "dam-muted" }, t("memoryCount", { count: topic ? relevant.filter((m) => m.status === "current").length : current.length }))),
        !showAll ? topic?.summary || overview.summary ? h("div", { className: "dam-overview-summary" }, h(Markdown, { text: topic?.summary || overview.summary, t })) : h("p", { className: "dam-overview-empty" }, t(current.length ? "overviewPending" : "overviewEmpty")) : null,
        overview.stale ? h("p", { className: "dam-hint" }, t("overviewStale")) : null,
        !topic && !showAll && issues.length ? h("section", { className: "dam-issues-inline" }, h("h3", null, t("showIssues", { count: issues.length })), ...issues.map((i) => h("button", { className: "dam-issue-row", key: i.id, onClick: () => {
          onSelect({ issueId: i.id, label: i.question || i.title });
          onDiscuss({ issueId: i.id, label: i.question || i.title });
        } }, h(Icon, { name: "chat", size: 16 }), h("span", null, i.question || i.title || t("needsDecision")), h("span", { "aria-hidden": true }, "\u203A")))) : null,
        !topic && !showAll ? h("section", { className: "dam-topics" }, h("div", { className: "dam-row" }, h("h3", null, t("topics")), h("button", { className: "dam-button subtle", onClick: () => setShowAll(true) }, t("allMemories"))), topics.length ? h("div", { className: "dam-topic-grid" }, ...topics.map((item) => h("button", { className: "dam-topic-card", key: item.id, onClick: () => onSelect({ topicId: item.id, label: item.title }) }, h("div", { className: "dam-row" }, h(Icon, { name: "folder", size: 19 }), h("span", { className: "dam-muted" }, t("memoryCount", { count: item.memoryIds?.length || 0 }))), h("h3", null, item.title), h("p", null, previewText(item.summary) || t("topicRead")), h("span", { className: "dam-topic-open" }, t("viewTopic"), " \u2192")))) : current.length ? h("p", { className: "dam-hint" }, t("overviewPending")) : h("div", { className: "dam-empty-topics" }, h(Icon, { size: 25 }), h("p", null, t("topicEmpty")))) : null,
        topic || showAll ? h("section", { className: "dam-topic-records" }, h("div", { className: "dam-library-toolbar" }, h("div", { className: "dam-search" }, h(Icon, { name: "search", size: 16 }), h("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: t("search"), "aria-label": t("search") })), showAll ? h("div", { className: "dam-filters", role: "group", "aria-label": t("allMemories") }, ...["all", "history"].map((key) => h("button", { key, "aria-pressed": category === key, onClick: () => setCategory(key) }, t(key)))) : null), filtered.length ? filtered.map((memory) => h(MemoryRecord, { key: memory.id, memory, act, t, onDiscuss })) : h(Empty, { title: query ? t("noMatches") : category === "history" ? t("emptyHistory") : t("emptyMemories"), description: null })) : null
      )
    );
  }
  function Activity({ data, act, busy, t, onDiscuss }) {
    const activity = visibleMemoryActivity(data.activity).map((item) => ({ ...item, summary: item.event_type === "overview.organized" ? t("topicsOrganized", { count: item.metadata?.topic_count ?? "\u2014" }) : item.event_type === "issue.resolved" ? t("issueResolved") : item.summary }));
    return h(
      "section",
      { className: "dam-section dam-memory-activity" },
      h("div", { className: "dam-section-head" }, h("div", null, h("h2", null, t("memoryActivity")), h("p", { className: "dam-hint" }, t("memoryActivityIntro"))), h("button", { className: "dam-button", disabled: busy || data.capabilities?.dream === false, onClick: () => act("dream") }, h(Icon, { name: "refresh", size: 15 }), t("dream"))),
      activity.length ? h("div", { className: "dam-timeline" }, ...activity.map((item, index) => h("div", { key: item.id || index }, h("span", { className: "dam-activity-origin" }, t({ G1: "ordinaryUpdate", G2: "stageUpdate", MEMORY_UI: "requestedUpdate", DREAMING: "automaticUpdate" }[item.channel] || "ordinaryUpdate")), h(Change, { item, t, showReview: true }), h("button", { className: "dam-button subtle", onClick: () => onDiscuss({ memoryId: item.memoryId || item.memory_id, label: item.summary, activityId: item.id }) }, t("askAboutChange"))))) : h(Empty, { icon: "history", title: t("emptyMemoryActivity"), description: t("emptyMemoryActivityHint") }),
      (data.jobs || []).length ? h("details", { className: "dam-disclosure dam-diagnostics" }, h("summary", null, t("recentConsolidations")), ...data.jobs.map((job) => h("article", { key: job.id, className: "dam-card" }, h("div", { className: "dam-row" }, h("strong", null, t(job.kind === "DREAMING" ? "automaticUpdate" : "stageUpdate")), h("span", { className: "dam-badge" }, jobPresentation(job, t).label)), jobPresentation(job, t).message ? h("p", { className: "dam-hint" }, jobPresentation(job, t).message) : null, h("details", { className: "dam-disclosure" }, h("summary", null, t("details")), h("dl", { className: "dam-usage" }, ...usagePresentation(job.usage, t).map((metric) => h("div", { key: metric.key }, h("dt", null, metric.label), h("dd", null, metric.value)))), job.error || jobPresentation(job, t).waiting ? h("pre", { className: "dam-body" }, errorText(job.error || job.deferral, t)) : null)))) : null
    );
  }
  function WorkspacePage({ project, userScope = false, t, onBack, backLabel, onSettings, onContentReady }) {
    const { data, error, busy, act, refresh, receipt, clearReceipt } = useMemoryState(userScope ? null : project.id);
    useEffect(() => {
      if (data || error) onContentReady?.();
    }, [!!data, !!error, onContentReady]);
    const [view, setView] = useState("current"), [selection, setSelection] = useState(null), [context, setContext] = useState(null), [focusRequest, setFocusRequest] = useState(0), [mobilePane, setMobilePane] = useState("memory");
    const contextValid = !context || (!context.topicId || data?.overview?.topics?.some((topic) => topic.id === context.topicId)) && (!context.issueId || data?.issues?.some((issue) => issue.id === context.issueId && issue.status !== "resolved")) && (!context.memoryId || data?.memories?.some((memory) => memory.id === context.memoryId));
    useEffect(() => {
      if (data && !contextValid) {
        setContext(null);
        setSelection(null);
      }
    }, [contextValid, data]);
    const discuss = (next) => {
      setContext({ ...next.issueId || next.activityId ? {} : selection || {}, ...next });
      setFocusRequest((value) => value + 1);
      setMobilePane("chat");
    };
    const tabs = userScope ? ["current", "activity"] : ["current", "activity"];
    return h(
      React.Fragment,
      null,
      h("header", { className: "dam-workspace-header" }, h("div", null, h("button", { className: "dam-button subtle dam-breadcrumb", onClick: onBack }, h(Icon, { name: "arrow", size: 15 }), backLabel || t("backToWorkspaces")), h("div", { className: "dam-workspace-title" }, h(Icon, { name: userScope ? "globe" : "folder", size: 22 }), h("h1", null, userScope ? t("profile") : project.name))), h("button", { className: "dam-button", onClick: onSettings }, h(Icon, { name: "settings", size: 16 }), t("settings"))),
      h("nav", { className: "dam-tabs", role: "tablist", "aria-label": userScope ? t("profile") : t("projectMemory"), onKeyDown: (event) => {
        const index = tabs.indexOf(view);
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + 2) % 2;
        setView(tabs[next]);
        event.currentTarget.querySelectorAll("[role=tab]")[next]?.focus();
      } }, ...tabs.map((key) => h("button", { key, role: "tab", "aria-selected": key === view, tabIndex: key === view ? 0 : -1, onClick: () => setView(key) }, t(key === "current" ? userScope ? "profileTitle" : "currentMemory" : "memoryActivity")))),
      h("div", { className: "dam-mobile-panes", role: "group", "aria-label": t("pageArea") }, ...["memory", "chat"].map((key) => h("button", { className: "dam-button", key, "aria-pressed": mobilePane === key, onClick: () => setMobilePane(key) }, t(key === "memory" ? "currentMemory" : "managerTitle")))),
      h(
        "div",
        { className: "dam-workspace-split", "data-mobile-pane": mobilePane },
        h(
          "main",
          { className: "dam-memory-pane", "aria-label": t("memoryDisplay") },
          h(Receipt, { value: receipt, onClose: clearReceipt, t }),
          h(ErrorNotice, { error, retry: refresh, t }),
          !data && !error ? h(Loading, { t }) : null,
          data && project?.detached ? h("p", { className: "dam-inline-status" }, t("retainedHint")) : null,
          data && !userScope && data.workspace?.enabled === false ? h("p", { className: "dam-inline-status" }, t("memoryPausedReadable")) : null,
          data && userScope ? view === "current" ? h("article", { className: "dam-overview" }, h("p", { className: "dam-eyebrow" }, t("globalScope")), h("h2", null, t("profileTitle")), h("p", { className: "dam-hint" }, t("profileScopeHint")), data.userProfile?.content ? h("div", { className: "dam-overview-summary" }, h(Markdown, { text: data.userProfile.content, t })) : h(Empty, { icon: "globe", title: t("profileEmpty"), description: t("profileChatEmpty") })) : h("section", { className: "dam-section" }, h("h2", null, t("profileChanges")), data.userProfile?.changes?.length ? data.userProfile.changes.map((item, index) => h(Change, { key: item.id || index, item, t })) : h(Empty, { icon: "history", title: t("emptyProfileChanges") })) : data ? view === "current" ? h(Overview, { data, selected: selection, onSelect: (next) => {
            setSelection(next);
            setContext(next);
          }, onDiscuss: discuss, act, t }) : h(Activity, { data, act, busy, t, onDiscuss: discuss }) : null
        ),
        h(ManagerChat, { workspaceId: userScope ? null : project.id, nativeWorkspaceId: userScope ? null : project.nativeWorkspaceId, userScope, context: contextValid ? context : null, contextLabel: contextValid && context?.label || (userScope ? t("profile") : t("wholeProject")), t, onUpdated: refresh, focusRequest })
      )
    );
  }
  function ProjectPreferences({ project, t, onCatalogRefresh, onContentReady }) {
    const { data, error, busy, act, receipt, clearReceipt } = useMemoryState(project.id);
    useEffect(() => {
      if (data || error) onContentReady?.();
    }, [!!data, !!error, onContentReady]);
    if (!data) return h(React.Fragment, null, h(ErrorNotice, { error, t }), !error ? h(Loading, { t }) : null);
    return h(
      "div",
      { className: "dam-project-preferences" },
      h(Receipt, { value: receipt, onClose: clearReceipt, t }),
      h(ErrorNotice, { error, t }),
      h(
        "div",
        { className: "dam-settings-control-list" },
        ...[["enabled", "project-toggle", "useProjectMemory", "useProjectMemoryHint"], ["automaticDream", "project-dream-toggle", "automaticConsolidation", "automaticConsolidationHint"]].map(([key, action, title, hint]) => h("label", { className: "dam-setting-row", key }, h("span", null, h("strong", null, t(title)), h("span", { className: "dam-hint" }, t(hint))), h("input", { type: "checkbox", role: "switch", checked: data.workspace?.[key] !== false, disabled: busy || key === "automaticDream" && project.detached, onChange: async (e) => {
          const result = await act(action, { enabled: e.target.checked });
          if (result) onCatalogRefresh();
        } }))),
        project.detached ? h("p", { className: "dam-hint" }, t("retainedHint")) : null
      )
    );
  }
  function SettingsPage({ catalog, nativeSessions, t, onBack, backLabel, onOpenProject, onCatalogRefresh, viewState = {}, onViewStateChange, onContentReady }) {
    const { data, error, busy, act, refresh, receipt, clearReceipt } = useMemoryState(null);
    const section = viewState.section || "general", projectKey = viewState.projectKey || "";
    const setSection = (value) => onViewStateChange((current) => ({ ...current, section: value }));
    const setProjectKey = (value) => onViewStateChange((current) => ({ ...current, projectKey: value }));
    const all = [...catalog.projects || [], ...catalog.retainedProjects || []];
    const project = all.find((p) => p.key === projectKey) || all[0];
    useEffect(() => {
      if (section === "archive" || section === "workspaces" ? !project?.id : !!data || !!error) onContentReady?.();
    }, [section, project?.id, !!data, !!error, onContentReady]);
    return h(
      React.Fragment,
      null,
      h("header", { className: "dam-workspace-header" }, h("div", null, h("button", { className: "dam-button subtle dam-breadcrumb", onClick: onBack }, h(Icon, { name: "arrow", size: 15 }), backLabel || t("backToWorkspaces")), h("h1", null, t("settings")))),
      h(
        "div",
        { className: "dam-settings-layout" },
        h("nav", { className: "dam-settings-nav", "aria-label": t("settings") }, ...["general", "workspaces", "profile", "archive"].map((key) => h("button", { key, className: "dam-button", "aria-current": section === key ? "page" : void 0, onClick: () => setSection(key) }, t({ general: "modelsAndConsolidation", workspaces: "workspacePreferences", profile: "profileControls", archive: "archiveAndHistory" }[key])))),
        h(
          "div",
          { className: "dam-settings-main" },
          h(Receipt, { value: receipt, onClose: clearReceipt, t }),
          h(ErrorNotice, { error, retry: refresh, t }),
          !data && !error ? h(Loading, { t }) : null,
          data && section === "general" ? h(Settings, { data, act, busy, t }) : null,
          data && section === "profile" ? h("section", { className: "dam-section" }, h("h2", null, t("profileControls")), h("p", { className: "dam-hint" }, t("profileIntro")), ...[["enabled", "profileEnabled"], ["autoWrite", "autoWrite"]].map(([key, label]) => h("label", { className: "dam-setting-row", key }, h("strong", null, t(label)), h("input", { type: "checkbox", role: "switch", checked: data.userProfile?.[key] !== false, disabled: busy, onChange: (e) => act("user-profile-toggle", { [key]: e.target.checked }) })))) : null,
          section === "workspaces" ? h("section", { className: "dam-section" }, h("h2", null, t("workspacePreferences")), all.length ? h(React.Fragment, null, h("label", { className: "dam-field" }, h("span", null, t("chooseProject")), h("select", { value: project?.key || "", onChange: (e) => setProjectKey(e.target.value) }, ...all.map((p) => h("option", { key: p.key, value: p.key, disabled: !p.canBrowse }, p.name)))), project?.id ? h(ProjectPreferences, { key: project.key, project, t, onCatalogRefresh, onContentReady }) : null) : h(Empty, { title: t("noWorkspaces") })) : null,
          section === "archive" ? h("section", { className: "dam-section" }, h("h2", null, t("archiveAndHistory")), h("p", { className: "dam-hint" }, t("archiveHint")), h("section", { className: "dam-settings-archive-section" }, h("h3", null, t("retainedWorkspaces")), (catalog.retainedProjects || []).length ? catalog.retainedProjects.map((p) => h("button", { key: p.key, className: "dam-archive-row", onClick: () => onOpenProject(p, { projectKey: project?.key || "" }) }, h(Icon, { name: "folder", size: 18 }), h("span", null, h("strong", null, p.name), h("span", { className: "dam-muted" }, t("retainedRead"))), h("span", { "aria-hidden": true }, "\u203A"))) : h("p", { className: "dam-hint" }, t("noRetainedWorkspaces"))), h("section", { className: "dam-settings-archive-section" }, h("h3", null, t("includeHistory")), h("p", { className: "dam-hint" }, t("includeHistoryHint")), all.length ? h(React.Fragment, null, h("label", { className: "dam-field" }, h("span", null, t("chooseProject")), h("select", { value: project?.key || "", onChange: (e) => setProjectKey(e.target.value) }, ...all.map((p) => h("option", { key: p.key, value: p.key, disabled: !p.canBrowse }, p.name)))), project?.id ? h(HistoryPreferences, { key: project.key, project, nativeSessions, t, onContentReady, viewState: viewState.history?.[project.key] || {}, onViewStateChange: (history) => onViewStateChange((current) => ({ ...current, history: { ...current.history, [project.key]: typeof history === "function" ? history(current.history?.[project.key] || {}) : history } })) }) : null) : null)) : null
        )
      )
    );
  }
  function HistoryPreferences({ project, nativeSessions, t, viewState, onViewStateChange, onContentReady }) {
    const { data, error, busy, act, receipt, clearReceipt } = useMemoryState(project.id);
    useEffect(() => {
      if (data || error) onContentReady?.();
    }, [!!data, !!error, onContentReady]);
    return h(React.Fragment, null, h(Receipt, { value: receipt, onClose: clearReceipt, t }), h(ErrorNotice, { error, t }), data ? h(PastSessions, { data, nativeSessions, act, busy, t, viewState, onViewStateChange }) : !error ? h(Loading, { t }) : null);
  }
  function navigateMemoryPage(route, action) {
    const current = { ...route, scrollTop: Math.max(0, action.scrollTop ?? route.scrollTop ?? 0) };
    const visit = (route.visit || 0) + 1;
    if (action.type === "settings-state") {
      if (route.page !== "settings" || action.expectedVisit != null && action.expectedVisit !== route.visit) return route;
      return { ...current, settingsState: typeof action.value === "function" ? action.value(current.settingsState || {}) : action.value };
    }
    if (action.type === "back") return { ...current.returnTo || { page: "home", scrollTop: 0 }, visit };
    if (action.type === "home") return { page: "home", visit, scrollTop: 0 };
    if (action.type === "settings" && current.returnTo?.page === "settings") return { ...current.returnTo, visit };
    if (action.type === "settings") return { page: "settings", visit, scrollTop: 0, settingsState: {}, returnTo: current };
    if (action.type === "workspace") {
      const origin = current.page === "settings" && action.settingsPatch ? { ...current, settingsState: { ...current.settingsState, ...action.settingsPatch } } : current;
      return { page: "workspace", key: action.key, visit, scrollTop: 0, returnTo: origin };
    }
    if (action.type === "profile") return { page: "profile", visit, scrollTop: 0, returnTo: current };
    return route;
  }
  function captureMemoryNavigation(action, scrollTop) {
    const command = { ...action, scrollTop };
    return (route) => navigateMemoryPage(route, command);
  }
  function returnLabel(route, t) {
    if (route.returnTo?.page === "settings") return t(route.returnTo.settingsState?.section === "archive" ? "backToArchive" : "backToSettings");
    if (route.returnTo?.page === "workspace") return t("backToWorkspaceMemory");
    if (route.returnTo?.page === "profile") return t("backToProfile");
    return t("backToWorkspaces");
  }
  function Page({ t, useSessions, useWorkspaces }) {
    const nativeSessions = useSessions ? useSessions((s) => s.byId) : {};
    const nativeSnapshot = useWorkspaces ? useWorkspaces((s) => s) : null;
    const signature = JSON.stringify(nativeSnapshot?.items?.map((w) => [w.workspaceId, w.title, w.path, w.sessionIds]));
    const [catalog, setCatalog] = useState({ projects: [], retainedProjects: [] }), [route, setRoute] = useState({ page: "home", visit: 0 }), [error, setError] = useState(null), [loaded, setLoaded] = useState(false), [readyVisit, setReadyVisit] = useState(null);
    const mounted = useRef(false), request = useRef(null), pageElement = useRef(null), cancelledScrollVisit = useRef(null);
    const available = React.useSyncExternalStore(subscribeAvailability, availabilitySnapshot, availabilitySnapshot);
    const refresh = useCallback(async () => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      try {
        const value = await catalogRequest(controller.signal);
        if (mounted.current && !controller.signal.aborted) {
          setCatalog(value);
          setLoaded(true);
          setError(null);
        }
      } catch (error2) {
        if (mounted.current && !controller.signal.aborted) {
          setError(error2);
          setLoaded(true);
        }
      }
    }, []);
    useEffect(() => {
      mounted.current = true;
      void refresh();
      const wake = () => {
        if (!document.hidden) void refresh();
      };
      const timer = setInterval(wake, 15e3);
      window.addEventListener("focus", wake);
      return () => {
        mounted.current = false;
        request.current?.abort();
        clearInterval(timer);
        window.removeEventListener("focus", wake);
      };
    }, [refresh]);
    useEffect(() => {
      if (mounted.current) void refresh();
    }, [signature, refresh]);
    const displayProject = (p) => ({ ...p, name: p.name === "default-workspace" ? t("defaultWorkspace") : p.name, sessions: (p.sessions || []).map((s) => ({ ...s, title: nativeSessions?.[s.id]?.displayTitle?.trim() || (s.title !== s.id ? s.title : t("untitledConversation")) })) });
    const projects = (catalog.nativeWorkspaces ? workspaceProjects(catalog.projects || [], nativeSnapshot?.items) : catalog.projects || []).map(displayProject);
    const retainedProjects = (catalog.retainedProjects || []).map(displayProject);
    const project = [...projects, ...retainedProjects].find((p) => p.key === route.key);
    const navigate = (action) => {
      const scrollTop = pageElement.current?.scrollTop || 0;
      setRoute(captureMemoryNavigation(action, scrollTop));
    };
    const enter = (project2, settingsPatch) => navigate({ type: "workspace", key: project2.key, settingsPatch });
    const back = () => navigate({ type: "back" });
    const settings = () => navigate({ type: "settings" });
    useEffect(() => {
      if (route.page === "home" && loaded) setReadyVisit(route.visit);
    }, [route.page, route.visit, loaded]);
    useEffect(() => {
      const element = pageElement.current;
      if (!element || cancelledScrollVisit.current === route.visit) return;
      const top = route.scrollTop || 0, ready = readyVisit === route.visit;
      let observer, stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        observer?.disconnect();
        element.removeEventListener("wheel", cancel);
        element.removeEventListener("touchstart", cancel);
        element.removeEventListener("keydown", cancel);
      };
      const cancel = () => {
        cancelledScrollVisit.current = route.visit;
        stop();
      };
      const restore = () => {
        if (stopped) return;
        element.scrollTop = top;
        if (ready) stop();
      };
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(restore);
        observer.observe(element.querySelector(".dam-shell") || element);
      }
      element.addEventListener("wheel", cancel, { passive: true });
      element.addEventListener("touchstart", cancel, { passive: true });
      element.addEventListener("keydown", cancel);
      restore();
      return stop;
    }, [route.visit, readyVisit === route.visit]);
    const effectiveCatalog = { ...catalog, projects, retainedProjects };
    useEffect(() => {
      if (loaded && route.page === "workspace" && !project) back();
    }, [loaded, route.page, route.key, !!project]);
    return h("div", { ref: pageElement, className: "dam-root dam-page dam-workflow-page" }, h("style", null, STYLE), h(
      "div",
      { className: "dam-shell" },
      !available ? h(Empty, { title: t("unavailable") }) : route.page === "workspace" && project ? h(WorkspacePage, { key: route.visit + ":" + project.key, project, t, onBack: back, backLabel: returnLabel(route, t), onSettings: settings, onContentReady: () => setReadyVisit(route.visit) }) : route.page === "profile" ? h(WorkspacePage, { key: "user:" + route.visit, userScope: true, t, onBack: back, backLabel: returnLabel(route, t), onSettings: settings, onContentReady: () => setReadyVisit(route.visit) }) : route.page === "settings" ? h(SettingsPage, { key: "settings:" + route.visit, catalog: effectiveCatalog, nativeSessions, t, onBack: back, backLabel: returnLabel(route, t), onOpenProject: enter, onCatalogRefresh: refresh, viewState: route.settingsState || {}, onContentReady: () => setReadyVisit(route.visit), onViewStateChange: (value) => navigate({ type: "settings-state", value, expectedVisit: route.visit }) }) : h(
        React.Fragment,
        null,
        h("header", { className: "dam-page-header" }, h("div", { className: "dam-heading" }, h("div", { className: "dam-title" }, h(Icon, { size: 25 }), h("h1", null, t("pageTitle"))), h("p", { className: "dam-subtitle" }, t("homeSubtitle"))), h("button", { className: "dam-button", onClick: settings }, h(Icon, { name: "settings", size: 16 }), t("settings"))),
        h(ErrorNotice, { error, retry: refresh, t }),
        !loaded ? h(Loading, { t }) : h("section", { className: "dam-home-workspaces", "aria-label": t("workspaces") }, h("div", { className: "dam-section-head" }, h("h2", null, t("workspaces")), h("span", { className: "dam-muted" }, t("projectCount", { count: projects.length }))), projects.length ? h("div", { className: "dam-workspace-grid" }, ...projects.map((p) => h("button", { className: "dam-workspace-card", key: p.key, disabled: !p.canBrowse, onClick: () => enter(p), "aria-label": t("openWorkspaceMemory", { name: p.name }) }, h("span", { className: "dam-workspace-card-icon" }, h(Icon, { name: "folder", size: 23 })), h("h3", null, p.name), h("p", null, previewText(p.summary) || (p.enabled === false ? t("memoryPausedReadable") : t("workspaceCardHint"))), h("span", { className: "dam-workspace-card-open" }, t("openMemory"), " \u2192")))) : h(Empty, { title: t("noWorkspaces"), description: t("noWorkspacesHint") })),
        h("button", { className: "dam-global-card", onClick: () => navigate({ type: "profile" }) }, h("span", { className: "dam-workspace-card-icon" }, h(Icon, { name: "globe", size: 23 })), h("span", null, h("strong", null, t("profileTitle")), h("span", { className: "dam-muted" }, t("profileSubtitle"))), h("span", { className: "dam-global-open", "aria-hidden": true }, "\u2192"))
      )
    ));
  }
  function migrateLegacyTabs(sidebar, schedule = requestAnimationFrame, cancel = cancelAnimationFrame) {
    let frame = null, stopped = false;
    const wake = () => {
      if (frame !== null) cancel(frame);
      const sessionId = sidebar.mounted.getSnapshot();
      if (!sessionId || stopped) return;
      frame = schedule(() => {
        frame = schedule(() => {
          frame = null;
          if (stopped || sidebar.mounted.getSnapshot() !== sessionId) return;
          for (const tab of sidebar.tabsIn(sessionId)) if (tab.kind === NS) sidebar.close(tab.id);
        });
      });
    };
    const stops = [sidebar.mounted.subscribe(wake), sidebar.openTabs.subscribe(wake)];
    wake();
    return () => {
      stopped = true;
      if (frame !== null) cancel(frame);
      stops.forEach((stop) => stop());
    };
  }
  function apply(ctx) {
    const t = ctx.locale.bind(NS);
    ctx.effect(() => createAvailabilityMonitor().dispose, "automemory: availability");
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "automemory: copy");
    ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: NS, locale: NS, inject: () => ({ openSession: (id) => ctx.uiWorkspace.openSession(id) }) }, Page)), "automemory: page");
    ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => {
      let release;
      const sync = () => {
        if (serviceAvailable && !release) release = ctx.slots.register({ name: "sidebar.panellist", id: NS, order: 15, locale: NS, label: () => t("tab") }, Icon);
        else if (!serviceAvailable && release) {
          release();
          release = null;
        }
      };
      sync();
      const unsubscribe = subscribeAvailability(sync);
      return () => {
        unsubscribe();
        release?.();
      };
    }), "automemory: navigation");
    ctx.inject?.(["sidebarRight"], (c) => {
      c.effect(() => migrateLegacyTabs(c.sidebarRight), "automemory: legacy tabs");
    });
  }
  return __toCommonJS(client_exports);
})();

return __AutoMemoryClient;}});
