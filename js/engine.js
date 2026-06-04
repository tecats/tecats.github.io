/**
 * T.E.C-OS 核心引擎
 * 游戏核心逻辑和状态管理
 */

import { CONFIG } from './config.js';
import { escapeHtml, escapeHtmlForRegex } from './utils.js';
import { gameplayManager } from './gameplay.js';

/**
 * 创建游戏引擎实例
 * @param {Object} projectData - 游戏数据
 * @returns {Object} 引擎实例
 */
function createEngine(projectData) {
    const Engine = {
        state: {
            caseId: "",
            currentScene: "",
            foundClueIds: [],
            gameFlags: {},
            matrix: { vision: [], hearing: [], touch: [], smell: [], taste: [] },
            charTalkIndex: {},
            achievedEndings: [],
            inventory: [],
            data: null,
            lastSaveLogTime: 0,
            hintedEndings: []
        },

        // 日志缓冲区
        logBuffer: [],
        logFlushTimer: null,
        timeIntervalId: null,

        /**
         * 初始化引擎（基础初始化，不自动进入游戏）
         */
        init() {
            window.Engine = this;
            this.state.data = projectData;
                    
            // 从 URL参数读取案件ID
            this.state.caseId = window.__GAME_CASE_ID__ || 'default';
            this.state.fresh = window.__GAME_FRESH__ || false;
        
            // 设置版本号显示
            const bootTitle = document.getElementById('boot-title');
            if (bootTitle) {
                bootTitle.textContent = `T.E.C-OS [${CONFIG.VERSION.toUpperCase()}]`;
            }
        
            this.initBroadcastChannel();
            this.initCommandLine();
            this.initContextMenu();
            this.initLogContainer();
            this.initKeyboardShortcuts();
        
            // 根据案件ID加载存档（仅读取，不自动恢复）
            const saveKey = this.state.caseId === 'default' 
                ? CONFIG.SAVE_KEY 
                : CONFIG.getCaseSaveKey(this.state.caseId);
            this.savedState = localStorage.getItem(saveKey);
        
            // 显示启动界面按钮
            this.showBootButtons();
        
            this.checkEditorUpdate();
        },

        /**
         * 显示启动界面按钮
         */
        showBootButtons() {
            const connectBtn = document.getElementById('connect-btn');
            const clearBtn = document.getElementById('clear-btn');
            const backBtn = document.getElementById('back-btn');
            const loadingStatus = document.getElementById('loading-status');

            if (loadingStatus) {
                loadingStatus.textContent = '系统初始化完成';
            }

            if (connectBtn) connectBtn.style.display = 'block';
            if (backBtn) backBtn.style.display = 'block';
            
            // 只有存在存档时才显示清除按钮
            if (clearBtn && this.savedState) {
                clearBtn.style.display = 'block';
            }
        },

        /**
         * 开始游戏（用户点击"接入因果核心"按钮后调用）
         */
        startGame() {
            const fresh = this.state.fresh;
            
            if (this.savedState && !fresh) {
                try {
                    const parsedState = JSON.parse(this.savedState);
                    Object.assign(this.state, {
                        currentScene: parsedState.currentScene,
                        foundClueIds: parsedState.foundClueIds || [],
                        gameFlags: parsedState.gameFlags || {},
                        matrix: parsedState.matrix || { vision: [], hearing: [], touch: [], smell: [], taste: [] },
                        charTalkIndex: parsedState.charTalkIndex || {},
                        achievedEndings: parsedState.achievedEndings || [],
                        inventory: parsedState.inventory || []
                    });

                    document.getElementById('boot-overlay').style.display = 'none';
                    document.getElementById('main-system').style.visibility = 'visible';
                    this.renderScene();
                    this.startTime();
                    this.renderSavedState();
                    this.addLog(`T.E.C-OS ${CONFIG.VERSION} 内核已启动。检测到存档数据。`, "sys");
                    this.addLog("正在恢复上次会话...", "sys");
                } catch (e) {
                    this.startFresh();
                }
            } else {
                this.startFresh();
            }
        },

        /**
         * 全新开始
         */
        startFresh() {
            this.state.currentScene = this.state.data.config.startScene;
            this.state.achievedEndings = [];
            document.getElementById('boot-overlay').style.display = 'none';
            document.getElementById('main-system').style.visibility = 'visible';
            this.renderScene();
            this.startTime();
            this.renderSavedState();
            this.addLog(`T.E.C-OS ${CONFIG.VERSION} 内核已启动。吸取完成，已确认权限。`, "sys");
        },

        /**
         * 初始化命令行
         */
        initCommandLine() {
            document.getElementById('command-line').onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const input = e.target.value;
                    e.target.value = "";
                    this.handleCommand(input);
                }
            };
        },

        /**
         * 初始化右键菜单
         */
        initContextMenu() {
            document.addEventListener('click', () => {
                document.getElementById('context-menu').style.display = 'none';
            });
        },

        /**
         * 初始化日志容器
         */
        initLogContainer() {
            const logContainer = document.getElementById('log-container');
            if (logContainer) {
                this.bindInteractiveEvents(logContainer);
            }
        },

        /**
         * 初始化键盘快捷键
         */
        initKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // H 键切换纯观图模式（当焦点不在输入框时）
                if ((e.key === 'h' || e.key === 'H') && 
                    document.activeElement.tagName !== 'INPUT' &&
                    document.activeElement.tagName !== 'TEXTAREA') {
                    this.togglePureView();
                }
            });
        },

        /**
         * 初始化 BroadcastChannel
         */
        initBroadcastChannel() {
            try {
                const channel = new BroadcastChannel(CONFIG.EDITOR_SYNC.CHANNEL_NAME);
                channel.onmessage = (event) => {
                    if (event.data.type === 'sync_data') {
                        console.log('[游戏] 收到编辑器同步数据');
                        this.showEditorUpdatePrompt(event.data.data, event.data.timestamp);
                    }
                };
            } catch (e) {
                console.log('[游戏] BroadcastChannel 初始化失败，降级到 localStorage 检查');
            }
        },

        /**
         * 检查编辑器更新
         */
        checkEditorUpdate() {
            const syncData = localStorage.getItem(CONFIG.EDITOR_SYNC.SYNC_KEY);
            const syncTimestamp = localStorage.getItem(CONFIG.EDITOR_SYNC.SYNC_TIMESTAMP_KEY);

            if (!syncData || !syncTimestamp) return;

            const timestamp = parseInt(syncTimestamp);
            if (Date.now() - timestamp > CONFIG.EDITOR_SYNC.EXPIRE_TIME) {
                localStorage.removeItem(CONFIG.EDITOR_SYNC.SYNC_KEY);
                localStorage.removeItem(CONFIG.EDITOR_SYNC.SYNC_TIMESTAMP_KEY);
                return;
            }

            const newData = JSON.parse(syncData);
            if (JSON.stringify(this.state.data) !== JSON.stringify(newData)) {
                const savedState = localStorage.getItem(CONFIG.SAVE_KEY);
                if (savedState) {
                    setTimeout(() => {
                        this.showEditorUpdatePrompt(newData, timestamp);
                    }, 500);
                }
            }
        },

        /**
         * 显示编辑器更新提示
         */
        showEditorUpdatePrompt(newData, timestamp) {
            const updateTime = new Date(timestamp).toLocaleTimeString('zh-CN');
            const msg = `编辑器已更新 (${updateTime})，是否加载新数据？\n\n注意：加载将保留当前游戏进度，但内容数据会更新。`;

            if (confirm(msg)) {
                this.loadEditorData(newData);
                this.addLog(`已加载编辑器最新数据。`, "sys");
            }
        },

        /**
         * 加载编辑器数据
         */
        loadEditorData(newData) {
            this.state.data = newData;
            this.renderScene();
            this.renderSavedState();
        },

        /**
         * 渲染保存的状态
         */
        renderSavedState() {
            // 渲染已发现的线索
            const cluesList = document.getElementById('clues-list');
            cluesList.innerHTML = '';
            this.state.foundClueIds.forEach(id => {
                const clue = this.state.data.clues[id];
                if (clue) {
                    const node = document.createElement('div');
                    node.className = 'clue-node';
                    node.id = `clue-node-${CSS.escape(id)}`;
                    node.innerText = `[${clue.type.toUpperCase()}] ${clue.label}`;
                    node.onclick = () => this.addToMatrix(id);
                    if (this.state.matrix[clue.type].includes(id)) {
                        node.classList.add('hidden');
                    }
                    cluesList.appendChild(node);
                }
            });

            // 渲染矩阵
            const matrixTypes = ['vision', 'hearing', 'touch', 'smell', 'taste'];
            matrixTypes.forEach(type => this.renderMatrixSlot(type));

            // 渲染结局历史
            const history = document.getElementById('endings-history');
            history.innerHTML = '';
            this.state.achievedEndings.forEach(endingId => {
                const ending = this.state.data.endings.find(e => e.id === endingId);
                if (ending) {
                    const div = document.createElement('div');
                    div.id = `hist-${CSS.escape(ending.id)}`;
                    // 移除内联样式，使用 CSS 样式
                    div.innerHTML = `● <b>达成</b>：${escapeHtml(ending.name)}`;
                    history.appendChild(div);
                }
            });

            this.updateProgress();
        },

        /**
         * 渲染场景
         */
        renderScene() {
            const scene = this.state.data.scenes[this.state.currentScene];
            if (!scene) return;

            document.getElementById('loc-tag').innerText = `SCANNER // ${escapeHtml(scene.title)}`;
            
            // 处理场景背景图片
            const bgArtwork = document.getElementById('sceneBgArtwork');
            if (bgArtwork && scene.image) {
                // 清除旧内容
                bgArtwork.innerHTML = '';
                
                // 创建图片元素
                const img = new Image();
                img.alt = escapeHtml(scene.title);
                img.onload = () => {
                    bgArtwork.classList.add('loaded');
                };
                img.onerror = () => {
                    console.warn(`[场景图片加载失败] ${scene.image}`);
                    bgArtwork.classList.remove('loaded');
                };
                img.src = scene.image;
                bgArtwork.appendChild(img);
            } else if (bgArtwork) {
                // 没有图片时，移除 loaded 类
                bgArtwork.classList.remove('loaded');
                bgArtwork.innerHTML = '';
            }
            
            // 渲染场景文字内容
            const container = document.getElementById('text-scene');
            let rawText = scene.content;

            // 物品标签
            rawText = rawText.replace(/\[item:(.+?)\]/g, (m, id) => {
                const item = this.state.data.items[id];
                if (!item) return "";
                return `<span class="interactive-obj obj-item" data-type="items" data-id="${escapeHtml(id)}" role="button" tabindex="0" aria-label="查看物品: ${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>`;
            });

            // 角色标签
            rawText = rawText.replace(/\[char:(.+?)\]/g, (m, id) => {
                const char = this.state.data.chars[id];
                if (!char) return "";
                return `<span class="interactive-obj obj-char" data-type="chars" data-id="${escapeHtml(id)}" role="button" tabindex="0" aria-label="查看角色: ${escapeHtml(char.name)}">${escapeHtml(char.name)}</span>`;
            });

            // 场景标签
            rawText = rawText.replace(/\[loc:(.+?)\]/g, (m, id) => {
                const loc = this.state.data.scenes[id];
                if (!loc) return "";
                return `<span class="interactive-obj obj-loc" data-scene="${escapeHtml(id)}" role="button" tabindex="0" aria-label="前往: ${escapeHtml(loc.title)}">${escapeHtml(loc.title)}</span>`;
            });

            container.innerHTML = rawText.replace(/\n/g, '<br>');
            this.bindInteractiveEvents(container);
        },

        /**
         * 绑定交互事件
         */
        bindInteractiveEvents(container) {
            if (container.__eventBound) return;

            container.addEventListener('click', (e) => {
                const target = e.target.closest('.interactive-obj, .clue-link');
                if (!target) return;

                if (target.classList.contains('clue-link') && target.dataset.clueId) {
                    this.discoverClue(target.dataset.clueId);
                    return;
                }

                const type = target.dataset.type;
                const id = target.dataset.id;
                const sceneId = target.dataset.scene;

                if (type && id) {
                    this.showMenu(e, type, id);
                } else if (sceneId) {
                    this.switchScene(sceneId);
                }
            });

            container.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const target = e.target.closest('.interactive-obj, .clue-link');
                if (!target) return;

                e.preventDefault();
                if (target.classList.contains('clue-link') && target.dataset.clueId) {
                    this.discoverClue(target.dataset.clueId);
                    return;
                }

                const type = target.dataset.type;
                const id = target.dataset.id;
                const sceneId = target.dataset.scene;

                if (type && id) {
                    this.showMenu(e, type, id);
                } else if (sceneId) {
                    this.switchScene(sceneId);
                }
            });

            container.__eventBound = true;
        },

        /**
         * 显示右键菜单
         */
        showMenu(e, category, id) {
            e.stopPropagation();
            const menu = document.getElementById('context-menu');
            const targetData = this.state.data[category][id];
            if (!targetData) return;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const { ESTIMATED_WIDTH, ESTIMATED_HEIGHT, BOUNDARY_PADDING } = CONFIG.MENU;

            let left = Math.min(e.pageX, viewportWidth - ESTIMATED_WIDTH - BOUNDARY_PADDING);
            let top = Math.min(e.pageY - 10, viewportHeight - ESTIMATED_HEIGHT - BOUNDARY_PADDING);
            left = Math.max(left, BOUNDARY_PADDING);
            top = Math.max(top, BOUNDARY_PADDING);

            const fragment = document.createDocumentFragment();
            const extraData = {};
            if (targetData.image) extraData.image = targetData.image;
            if (targetData.audio) extraData.audio = targetData.audio;

            const observeText = targetData.desc || targetData.content || targetData.name || targetData.label || '';
            this.createMenuItem(fragment, { label: "观察 (EXAMINE)", type: "text", value: observeText }, id, false, extraData);

            if (category === 'chars') {
                this.createMenuItem(fragment, { label: "交谈 (TALK)", type: "talk" }, id);
            } else if (category === 'items') {
                if (targetData.canBePicked && !this.state.inventory.includes(id)) {
                    this.createMenuItem(fragment, { label: "记录", type: "pickup" }, id, true);
                }
                if (targetData.commands) {
                    targetData.commands.forEach(cmd => {
                        this.createMenuItem(fragment, cmd, id, true);
                    });
                }
            }

            menu.innerHTML = "";
            menu.appendChild(fragment);
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
            menu.style.display = 'block';
        },

        /**
         * 创建菜单项
         */
        createMenuItem(menu, action, targetId, isSpecial = false, extraData = {}) {
            const item = document.createElement('div');
            item.className = `menu-item ${isSpecial ? 'special' : ''}`;
            item.innerText = action.label;
            item.setAttribute('role', 'menuitem');
            item.setAttribute('tabindex', '0');
            item.dataset.targetId = escapeHtml(targetId);
            item.dataset.actionType = escapeHtml(action.type);
            item.dataset.actionValue = escapeHtml(action.value || '');
            if (extraData.image) item.dataset.image = escapeHtml(extraData.image);
            if (extraData.audio) item.dataset.audio = escapeHtml(extraData.audio);

            item.addEventListener('click', () => this.executeAction(targetId, action, extraData));
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.executeAction(targetId, action, extraData);
                }
            });

            menu.appendChild(item);
        },

        /**
         * 执行动作
         */
        executeAction(targetId, cmd, extraData = {}) {
            gameplayManager.execute(this, targetId, cmd, extraData);
        },

        /**
         * 处理文本中的标签
         */
        processTextWithClues(text) {
            if (!text) return "";
            let result = text;

            // 物品名称高亮
            const itemNameToId = {};
            for (const [id, item] of Object.entries(this.state.data.items || {})) {
                if (item.label) itemNameToId[item.label] = id;
            }
            const sortedNames = Object.keys(itemNameToId).sort((a, b) => b.length - a.length);
            for (const name of sortedNames) {
                const regex = new RegExp(escapeHtmlForRegex(name), 'g');
                result = result.replace(regex, `<span class="highlight-item">${escapeHtml(name)}</span>`);
            }

            // 物品标签
            result = result.replace(/\[item:(.+?)\]/g, (m, id) => {
                const item = this.state.data.items[id];
                if (!item) return "[未知物品]";
                return `<span class="highlight-item">${escapeHtml(item.label)}</span>`;
            });

            // 角色标签
            result = result.replace(/\[char:(.+?)\]/g, (m, id) => {
                const char = this.state.data.chars[id];
                if (!char) return "[未知角色]";
                return `<span class="highlight-char">${escapeHtml(char.name)}</span>`;
            });

            // 场景标签
            result = result.replace(/\[loc:(.+?)\]/g, (m, id) => {
                const loc = this.state.data.scenes[id];
                if (!loc) return "[未知场景]";
                return `<span class="highlight-loc">${escapeHtml(loc.title)}</span>`;
            });

            // 线索标签
            result = result.replace(/\[clue:(.+?)\]/g, (m, id) => {
                const clue = this.state.data.clues[id];
                if (!clue) return "[未知线索]";
                const label = escapeHtml(clue.label);
                if (this.state.foundClueIds.includes(id)) {
                    return `<span class="clue-synced">${label}</span>`;
                }
                return `<span class="clue-link clue-pending-${escapeHtml(id)}" data-clue-id="${escapeHtml(id)}" role="button" tabindex="0" aria-label="发现线索: ${label}">${label}</span>`;
            });

            result = result.replace(/\n/g, '<br>');
            return result;
        },

        /**
         * 发现线索
         */
        discoverClue(id) {
            if (!id || this.state.foundClueIds.includes(id)) return;
            const clue = this.state.data.clues[id];
            if (!clue) return;

            this.state.foundClueIds.push(id);
            const node = document.createElement('div');
            node.className = 'clue-node';
            node.id = `clue-node-${escapeHtml(id)}`;
            node.innerText = `[${clue.type.toUpperCase()}] ${clue.label}`;
            node.onclick = () => this.addToMatrix(id);
            document.getElementById('clues-list').appendChild(node);
            this.addLog(`已手动同步数据节点: ${escapeHtml(clue.label)}`, "sys");
            this.updateProgress();

            document.querySelectorAll(`.clue-pending-${CSS.escape(id)}`).forEach(el => {
                el.classList.remove(`clue-pending-${CSS.escape(id)}`, 'clue-link');
                el.classList.add('clue-synced');
                el.onclick = null;
            });

            this.checkEndingHint();
            this.saveGame();
        },

        /**
         * 检查结局提示
         */
        checkEndingHint() {
            for (const ending of this.state.data.endings || []) {
                if (ending.recipe?.length > 0) {
                    const allCollected = ending.recipe.every(clueId =>
                        this.state.foundClueIds.includes(clueId)
                    );
                    if (allCollected && !this.state.achievedEndings.includes(ending.id)) {
                        if (!this.state.hintedEndings?.includes(ending.id)) {
                            (this.state.hintedEndings ||= []).push(ending.id);
                            this.addLog(`似乎已经收集到足够的线索，可以尝试推演真相了...`, "hint");
                            break;
                        }
                    }
                }
            }
        },

        /**
         * 添加到矩阵
         */
        addToMatrix(id) {
            const clue = this.state.data.clues[id];
            if (!this.state.matrix[clue.type].includes(id)) {
                this.state.matrix[clue.type].push(id);
                this.renderMatrixSlot(clue.type);
                document.getElementById(`clue-node-${CSS.escape(id)}`).classList.add('hidden');
                this.saveGame();
                this.analyzeMatrixState();
            }
        },

        /**
         * 渲染矩阵槽位
         */
        renderMatrixSlot(type) {
            const container = document.getElementById(`slot-${type}`);
            container.innerHTML = "";
            this.state.matrix[type].forEach(id => {
                const div = document.createElement('div');
                div.className = 'mini-clue';
                div.innerText = this.state.data.clues[id].label;
                div.onclick = () => {
                    this.state.matrix[type] = this.state.matrix[type].filter(cid => cid !== id);
                    this.renderMatrixSlot(type);
                    document.getElementById(`clue-node-${CSS.escape(id)}`).classList.remove('hidden');
                    this.analyzeMatrixState();
                };
                container.appendChild(div);
            });
        },

        /**
         * 分析矩阵状态并生成提示
         */
        analyzeMatrixState() {
            const matrix = this.state.matrix;
            const senseTypes = ['vision', 'hearing', 'touch', 'smell', 'taste'];
            const senseLabels = { vision: '视觉', hearing: '听觉', touch: '触觉', smell: '嗅觉', taste: '味觉' };

            const currentIds = Object.values(matrix).flat();

            let hintMsg = '[逻辑节点同步完成]';

            const canInfer = this.state.data.endings.some(ending => {
                if (ending.recipe.length !== currentIds.length) return false;
                const sortedRecipe = [...ending.recipe].sort();
                const sortedCurrent = [...currentIds].sort();
                return sortedRecipe.every((val, index) => val === sortedCurrent[index]);
            });

            if (canInfer) {
                hintMsg += '<br>→ 因果链路已闭合，可执行「SYNC_MATRIX_INFERENCE」';
                this.addLog(hintMsg, 'sys');
                return;
            }

            const trueEnding = this.state.data.endings.find(e => e.id === 'TRUE_E');
            if (trueEnding) {
                const matchedClues = currentIds.filter(id => trueEnding.recipe.includes(id));
                const matchedCount = matchedClues.length;
                const totalRequired = trueEnding.recipe.length;

                const requiredTypes = trueEnding.recipe.map(id => this.state.data.clues[id]?.type).filter(Boolean);
                const matchedTypes = matchedClues.map(id => this.state.data.clues[id]?.type).filter(Boolean);

                const typeCount = {};
                requiredTypes.forEach(t => typeCount[t] = (typeCount[t] || 0) + 1);
                matchedTypes.forEach(t => typeCount[t] = (typeCount[t] || 0) - 1);

                const unmatchedTypes = [];
                Object.entries(typeCount).forEach(([type, count]) => {
                    if (count > 0) {
                        for (let i = 0; i < count; i++) {
                            unmatchedTypes.push(type);
                        }
                    }
                });

                const typeStr = unmatchedTypes.length > 0 
                    ? `未归因类型：${unmatchedTypes.map(t => senseLabels[t]).join('、')}` 
                    : '已完全归因';

                hintMsg += `<br>→ 真名捕获：${matchedCount}/${totalRequired}，${typeStr}`;
            }

            this.state.data.endings
                .filter(e => e.id !== 'TRUE_E')
                .forEach((ending, index) => {
                    const matchedClues = currentIds.filter(id => ending.recipe.includes(id));
                    const matchedCount = matchedClues.length;
                    const totalRequired = ending.recipe.length;

                    const requiredTypes = ending.recipe.map(id => this.state.data.clues[id]?.type).filter(Boolean);
                    const matchedTypes = matchedClues.map(id => this.state.data.clues[id]?.type).filter(Boolean);

                    const typeCount = {};
                    requiredTypes.forEach(t => typeCount[t] = (typeCount[t] || 0) + 1);
                    matchedTypes.forEach(t => typeCount[t] = (typeCount[t] || 0) - 1);

                    const unmatchedTypes = [];
                    Object.entries(typeCount).forEach(([type, count]) => {
                        if (count > 0) {
                            for (let i = 0; i < count; i++) {
                                unmatchedTypes.push(type);
                            }
                        }
                    });

                    const typeStr = unmatchedTypes.length > 0 
                        ? `未归因类型：${unmatchedTypes.map(t => senseLabels[t]).join('、')}` 
                        : '已完全归因';

                    hintMsg += `<br>→ 因果链#${index + 1}：${matchedCount}/${totalRequired}，${typeStr}`;
                });

            this.addLog(hintMsg, 'sys');
        },

        /**
         * 应用结果
         */
        applyResults(results) {
            if (!results) return;
            if (results.flags) results.flags.forEach(f => this.state.gameFlags[f] = true);
            // 支持 scene 和 gotoScene 两种属性名
            const targetScene = results.scene || results.gotoScene;
            if (targetScene) this.switchScene(targetScene);
            else this.renderScene();
            if (results.message) this.addLog(this.processTextWithClues(results.message), "info");
            if (results.items) {
                results.items.forEach(itemId => {
                    const itemData = this.state.data.items[itemId];
                    if (itemData?.canBePicked && !this.state.inventory.includes(itemId)) {
                        this.state.inventory.push(itemId);
                        this.addLog(`[记录成功] "${escapeHtml(itemData.label)}"已被记录在案。`, "sys");
                    }
                });
            }
            this.saveGame();
        },

        /**
         * 切换场景
         */
        switchScene(id) {
            if (this.state.currentScene === id) return;
            this.state.currentScene = id;
            this.renderScene();
            this.addLog(`坐标变更: ${escapeHtml(this.state.data.scenes[id].title)}`, "sys");
            this.saveGame();
        },

        /**
         * 处理命令
         */
        handleCommand(val) {
            const input = val.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ').trim();
            if (!input) return;

            this.addLog(`CMD> ${escapeHtml(input)}`, "cmd");

            if (input.startsWith("查询")) {
                const keyword = input.replace(/^查询\s+/, "").trim();
                if (keyword === "物品档案") {
                    this.showInventory();
                } else {
                    this.executeSearch(keyword);
                }
            } else if (input.startsWith("捕获")) {
                this.executeCapture(input.replace(/^捕获\s+/, "").trim());
            } else if (input.startsWith("前往")) {
                this.executeGoTo(input.replace(/^前往\s+/, "").trim());
            } else if (input.startsWith("检查更新") || input === "更新") {
                this.manualCheckUpdate();
            } else if (input.startsWith("出示")) {
                this.executePresent(input.replace(/^出示\s+/, "").trim());
            }
        },

        /**
         * 显示物品档案
         */
        showInventory() {
            if (this.state.inventory.length === 0) {
                this.addLog(`[物品档案] 当前为空`, "sys");
                return;
            }
            this.addLog(`[物品档案] 当前物品 (${this.state.inventory.length}件):`, "sys");
            this.state.inventory.forEach(itemId => {
                const item = this.state.data.items[itemId];
                if (item) {
                    this.addLog(`  · ${escapeHtml(item.label)}`, "info");
                } else {
                    this.addLog(`  · [未知物品]`, "warn");
                }
            });
        },

        /**
         * 执行搜索
         */
        executeSearch(keyword) {
            let found = false;
            this.addLog(`深度扫描关键字: "${escapeHtml(keyword)}"`, "sys");

            for (const [id, c] of Object.entries(this.state.data.clues)) {
                if (c.label === keyword && this.state.foundClueIds.includes(id)) {
                    this.addLog(`[CLUE] ${escapeHtml(c.label)} (● SYNCED)：${escapeHtml(c.desc)}`, "info", {
                        image: c.image || null, audio: c.audio || null
                    });
                    found = true;
                }
            }

            for (const item of Object.values(this.state.data.items)) {
                if (item.label === keyword) {
                    let desc = item.desc.replace(/<br\s*\/?>/gi, '\n');
                    desc = escapeHtml(desc).replace(/\n/g, '<br>');
                    this.addLog(`[ITEM] ${escapeHtml(item.label)}：${desc}`, "info", {
                        image: item.image || null, audio: item.audio || null
                    });
                    found = true;
                }
            }

            for (const scene of Object.values(this.state.data.scenes)) {
                if (scene.title === keyword) {
                    const descText = scene.desc || scene.content || '';
                    this.addLog(`[SCENE] ${escapeHtml(scene.title)}：${escapeHtml(descText)}`, "info", {
                        image: scene.image || null, audio: scene.audio || null
                    });
                    found = true;
                }
            }

            for (const char of Object.values(this.state.data.chars)) {
                if (char.name === keyword) {
                    this.addLog(`[CHAR] ${escapeHtml(char.name)}：${escapeHtml(char.desc)}`, "info", {
                        avatar: char.avatar || null, image: char.image || null, audio: char.audio || null
                    });
                    found = true;
                }
            }

            if (!found) this.addLog(`扫描结束：该关键字无因果响应。`, "error");
        },

        /**
         * 执行前往
         */
        executeGoTo(targetName) {
            if (!targetName) {
                this.addLog(`可用坐标列表：`, "sys");
                for (const [id, scene] of Object.entries(this.state.data.scenes)) {
                    const current = id === this.state.currentScene ? " [当前]" : "";
                    this.addLog(`  · ${escapeHtml(scene.title)}${current}`, "info");
                }
                return;
            }

            const sceneId = Object.keys(this.state.data.scenes).find(id =>
                this.state.data.scenes[id].title === targetName
            );

            if (sceneId) {
                this.switchScene(sceneId);
            } else {
                this.addLog(`错误：坐标 "${escapeHtml(targetName)}" 不存在或无法访问。`, "error");
            }
        },

        /**
         * 查找物品（支持ID和名称）
         */
        findItem(nameOrId) {
            const items = this.state.data.items || {};
            // 先按ID查找
            if (items[nameOrId]) {
                return { id: nameOrId, data: items[nameOrId] };
            }
            // 再按名称查找
            for (const [id, item] of Object.entries(items)) {
                if (item.label === nameOrId) {
                    return { id, data: item };
                }
            }
            return null;
        },

        /**
         * 查找角色（支持ID和名称）
         */
        findCharacter(nameOrId) {
            const chars = this.state.data.chars || {};
            // 先按ID查找
            if (chars[nameOrId]) {
                return { id: nameOrId, data: chars[nameOrId] };
            }
            // 再按名称查找
            for (const [id, char] of Object.entries(chars)) {
                if (char.name === nameOrId) {
                    return { id, data: char };
                }
            }
            return null;
        },

        /**
         * 查找场景物品
         */
        findSceneItem(name) {
            const scene = this.state.data.scenes[this.state.currentScene];
            if (!scene) return null;

            // 在场景内容中查找
            const items = this.state.data.items || {};
            for (const [id, item] of Object.entries(items)) {
                if (item.label === name) {
                    return { id, data: item };
                }
            }
            return null;
        },

        /**
         * 执行捕获
         */
        executeCapture(targetName) {
            let capturedTarget = null;
            const scene = this.state.data.scenes[this.state.currentScene];

            if (scene.title === targetName) capturedTarget = scene;
            if (!capturedTarget) capturedTarget = Object.values(this.state.data.items).find(i => i.label === targetName);
            if (!capturedTarget) capturedTarget = Object.values(this.state.data.chars).find(c => c.name === targetName);

            if (capturedTarget?.hiddenClue) {
                this.addLog(`成功捕获对象: ${escapeHtml(targetName)}`, "sys");
                this.addLog(`<div class="narrative-capture">${this.processTextWithClues(capturedTarget.hiddenClue.text)}</div>`, "info");
            } else {
                this.addLog(`捕获中止：目标 "${escapeHtml(targetName)}" 未检测到隐藏因果。`, "error");
            }
        },

        /**
         * 执行出示
         * 格式：出示 [物品A] [物品B]
         * 支持双向匹配：出示 A B 和 出示 B A 效果相同
         */
        executePresent(content) {
            // 解析输入
            const parts = content.split(/\s+/);
            if (parts.length < 2) {
                this.addLog(`指令格式错误。正确格式：出示 [物品A] [物品B]`, "error");
                return;
            }

            const name1 = parts[0];
            const name2 = parts.slice(1).join(' ');

            // 查找两个对象（物品或角色）
            const obj1 = this.findPresentableObject(name1);
            const obj2 = this.findPresentableObject(name2);

            if (!obj1 && !obj2) {
                this.addLog(`未找到 "${escapeHtml(name1)}" 和 "${escapeHtml(name2)}"。`, "error");
                return;
            }
            if (!obj1) {
                this.addLog(`未找到 "${escapeHtml(name1)}"。`, "error");
                return;
            }
            if (!obj2) {
                this.addLog(`未找到 "${escapeHtml(name2)}"。`, "error");
                return;
            }

            // 检查玩家是否拥有物品（角色作为目标不需要在inventory中）
            // obj1是物品的条件：不是角色，且在inventory中
            const obj1IsItem = obj1.type !== 'char' && this.state.inventory.includes(obj1.id);
            // obj2是物品的条件：不是角色，且在inventory中
            const obj2IsItem = obj2.type !== 'char' && this.state.inventory.includes(obj2.id);

            // 确定哪个是物品（玩家拥有的），哪个是目标
            let itemObj, targetObj;
            let isTargetChar = false;

            if (obj1IsItem && !obj2IsItem) {
                // obj1是物品，obj2是目标
                itemObj = obj1;
                targetObj = obj2;
            } else if (obj2IsItem && !obj1IsItem) {
                // obj2是物品，obj1是目标
                itemObj = obj2;
                targetObj = obj1;
            } else if (obj1IsItem && obj2IsItem) {
                // 玩家拥有两个物品，尝试两种顺序
                const reaction1 = this.findPresentReaction(obj2, obj1.id);
                if (reaction1) {
                    itemObj = obj1;
                    targetObj = obj2;
                } else {
                    const reaction2 = this.findPresentReaction(obj1, obj2.id);
                    if (reaction2) {
                        itemObj = obj2;
                        targetObj = obj1;
                    } else {
                        this.addLog(`"${escapeHtml(obj1.data.label)}" 和 "${escapeHtml(obj2.data.label)}" 之间没有交互效果。`, "info");
                        return;
                    }
                }
            } else {
                // 两个都不是inventory中的物品
                const obj1IsChar = obj1.type === 'char';
                const obj2IsChar = obj2.type === 'char';
                
                if (obj1IsChar && obj2IsChar) {
                    this.addLog(`不能对两个角色使用出示命令。`, "error");
                } else if (obj1IsChar) {
                    // obj1是角色，obj2不是物品也不是角色（说明obj2不存在或未找到）
                    this.addLog(`未找到 "${escapeHtml(name2)}"。`, "error");
                } else if (obj2IsChar) {
                    // obj2是角色，obj1不是物品也不是角色
                    this.addLog(`未找到 "${escapeHtml(name1)}"。`, "error");
                } else {
                    // 两个都不是角色也不在inventory中
                    this.addLog(`你还没有 "${escapeHtml(obj1.data.label)}" 和 "${escapeHtml(obj2.data.label)}"。`, "error");
                }
                return;
            }

            // 判断目标类型
            if (targetObj.type === 'char') {
                isTargetChar = true;
            }

            // 执行出示
            if (isTargetChar) {
                this.executePresentToChar(itemObj, { id: targetObj.id, data: targetObj.data });
            } else {
                this.executePresentToSceneItem(itemObj, { id: targetObj.id, data: targetObj.data });
            }
        },

        /**
         * 查找可出示的对象（物品或角色）
         */
        findPresentableObject(name) {
            // 先查找物品
            const item = this.findItem(name);
            if (item) {
                return { id: item.id, data: item.data, type: 'item' };
            }

            // 再查找角色
            const char = this.findCharacter(name);
            if (char) {
                return { id: char.id, data: char.data, type: 'char' };
            }

            // 查找场景中的物品
            const sceneItem = this.findSceneItem(name);
            if (sceneItem) {
                return { id: sceneItem.id, data: sceneItem.data, type: 'sceneItem' };
            }

            return null;
        },

        /**
         * 查找出示反应
         * 支持角色的 itemReactions/reactions 字段和场景物品的 presentReactions 字段
         */
        findPresentReaction(targetObj, itemId) {
            const data = targetObj.data;
            
            // 角色使用 itemReactions 或 reactions
            if (targetObj.type === 'char') {
                if (data.itemReactions && data.itemReactions[itemId]) {
                    return data.itemReactions[itemId];
                } else if (data.reactions && data.reactions[itemId]) {
                    return data.reactions[itemId];
                }
            }
            
            // 场景物品使用 presentReactions
            if (data.presentReactions && data.presentReactions[itemId]) {
                return data.presentReactions[itemId];
            }
            
            return null;
        },

        /**
         * 向角色出示物品
         */
        executePresentToChar(itemObj, charObj) {
            const char = charObj.data;
            const itemId = itemObj.id;

            let react = null;

            if (char.itemReactions?.[itemId]) {
                react = char.itemReactions[itemId];
            } else if (char.reactions?.[itemId]) {
                react = char.reactions[itemId];
            }

            if (react) {
                this.addLog(this.processTextWithClues(react.text), "info", {
                    avatar: char.avatar || null,
                    speaker: char.name,
                    image: react.image || null,
                    audio: react.audio || null
                });
                if (react.results) this.applyResults(react.results);
                return true;
            } else {
                this.addLog(`${char.name}没有表现出任何逻辑反馈。`, "info");
                return true;
            }
        },

        /**
         * 向物品出示物品
         */
        executePresentToSceneItem(itemObj, sceneItemObj) {
            const sceneItem = sceneItemObj.data;
            const itemId = itemObj.id;

            if (sceneItem?.presentReactions?.[itemId]) {
                const react = sceneItem.presentReactions[itemId];

                if (sceneItem.conditionFlags?.[itemId]) {
                    const condition = sceneItem.conditionFlags[itemId];
                    if (condition.flag && this.state.gameFlags[condition.flag]) {
                        this.addLog(this.processTextWithClues(condition.text), "info", {
                            image: condition.image || sceneItem.image || null,
                            audio: condition.audio || sceneItem.audio || null
                        });
                        if (condition.results) {
                            this.applyResults(condition.results);
                        } else if (condition.scene) {
                            // 直接跳转场景（简化版）
                            this.switchScene(condition.scene);
                        }
                        return true;
                    }
                }

                this.addLog(this.processTextWithClues(react.text), "info", {
                    image: react.image || sceneItem.image || null,
                    audio: react.audio || sceneItem.audio || null
                });
                if (react.results) this.applyResults(react.results);
                return true;
            } else {
                this.addLog(`"${sceneItem.label}"没有对此物品产生反应。`, "info");
                return true;
            }
        },

        /**
         * 显示模态框
         */
        showModal({ title, body, hasInput, confirm }) {
            const modal = document.getElementById('ui-modal');
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-body').innerHTML = this.processTextWithClues(body);
            const container = document.getElementById('modal-input-container');
            container.innerHTML = hasInput ? `<input type="text" id="modal-val" style="width:100%; background:transparent; border:1px solid #0969da; color:#0969da; padding:10px; font-family:inherit; border-radius:4px;">` : "";
            modal.style.display = "block";
            document.getElementById('modal-confirm').onclick = () => {
                confirm(hasInput ? document.getElementById('modal-val').value : null);
            };
        },

        /**
         * 关闭模态框
         */
        closeModal() {
            document.getElementById('ui-modal').style.display = "none";
        },

        /**
         * 添加日志
         */
        addLog(msg, type, options = {}) {
            this.logBuffer.push({
                msg, type,
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                ...options
            });

            if (this.logBuffer.length > CONFIG.LOG.MAX_BUFFER_SIZE) {
                this.logBuffer.shift();
            }

            if (this.logFlushTimer) clearTimeout(this.logFlushTimer);
            this.logFlushTimer = setTimeout(() => this.flushLogs(), CONFIG.LOG.BUFFER_FLUSH_INTERVAL);
        },

        /**
         * 刷新日志
         */
        flushLogs() {
            if (this.logBuffer.length === 0) return;

            const container = document.getElementById('log-container');
            const colors = {
                sys: "#0969da",
                error: "#cf222e",
                cmd: "#bf8700",
                info: "#24292f",
                hint: "#656d76"
            };

            const fragment = document.createDocumentFragment();

            this.logBuffer.forEach(({ msg, type, time, avatar, speaker, image, audio }) => {
                const div = document.createElement('div');
                div.className = 'log-entry';

                let html = '';

                if (avatar || speaker) {
                    html += `<div class="weibo-entry">`;
                    if (avatar) {
                        html += `<div class="weibo-avatar"><img src="${escapeHtml(avatar)}" alt="avatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2240%22>?</text></svg>'"></div>`;
                    } else {
                        html += `<div class="weibo-avatar weibo-avatar-placeholder"><span>?</span></div>`;
                    }
                    html += `<div class="weibo-content">`;
                    if (speaker) html += `<div class="weibo-speaker">${escapeHtml(speaker)}</div>`;
                    html += `<div class="weibo-text" style="color:${colors[type]}">${msg}</div>`;
                    if (image) html += `<div class="weibo-media"><img src="${escapeHtml(image)}" alt="image" class="weibo-image" onclick="engine.previewImage(this.src)"></div>`;
                    if (audio) html += `<div class="weibo-media"><audio controls src="${escapeHtml(audio)}" class="weibo-audio"></audio></div>`;
                    html += `</div></div>`;
                } else {
                    html += `<div class="log-with-media">`;
                    html += `<span class="log-time">[${escapeHtml(time)}]</span> <span style="color:${colors[type]}">${msg}</span>`;
                    if (image) html += `<div class="log-image"><img src="${escapeHtml(image)}" alt="image" class="weibo-image" onclick="engine.previewImage(this.src)"></div>`;
                    if (audio) html += `<div class="log-audio"><audio controls src="${escapeHtml(audio)}"></audio></div>`;
                    html += `</div>`;
                }

                div.innerHTML = html;
                fragment.appendChild(div);
            });

            container.appendChild(fragment);
            container.scrollTop = container.scrollHeight;
            this.logBuffer = [];
        },

        /**
         * 图片预览
         */
        previewImage(src) {
            const overlay = document.createElement('div');
            overlay.className = 'image-preview-overlay';
            overlay.innerHTML = `<img src="${src}" alt="preview"><span class="close-btn">×</span>`;
            overlay.onclick = (e) => {
                if (e.target.classList.contains('close-btn') || e.target.classList.contains('image-preview-overlay')) {
                    overlay.remove();
                }
            };
            document.body.appendChild(overlay);
        },

        /**
         * 更新进度
         */
        updateProgress() {
            const current = this.state.foundClueIds.length;
            const total = Object.keys(this.state.data.clues).length;
            document.getElementById('progress-tag').innerText = `SYNC: ${(current / total * 100).toFixed(2)}%`;
        },

        /**
         * 启动时钟
         */
        startTime() {
            if (this.timeIntervalId) clearInterval(this.timeIntervalId);
            this.timeIntervalId = setInterval(() => {
                document.getElementById('os-time').innerText = new Date().toLocaleTimeString();
            }, 1000);
        },

        /**
         * 停止时钟
         */
        stopTime() {
            if (this.timeIntervalId) {
                clearInterval(this.timeIntervalId);
                this.timeIntervalId = null;
            }
        },

        /**
         * 保存游戏
         */
        saveGame() {
            const saveData = {
                caseId: this.state.caseId,
                currentScene: this.state.currentScene,
                foundClueIds: this.state.foundClueIds,
                gameFlags: this.state.gameFlags,
                matrix: this.state.matrix,
                charTalkIndex: this.state.charTalkIndex,
                achievedEndings: this.state.achievedEndings,
                inventory: this.state.inventory,
                savedAt: Date.now()
            };

            try {
                const saveKey = this.state.caseId === 'default' 
                    ? CONFIG.SAVE_KEY 
                    : CONFIG.getCaseSaveKey(this.state.caseId);
                localStorage.setItem(saveKey, JSON.stringify(saveData));
                
                // 更新存档索引
                this.updateSaveIndex(this.state.caseId, {
                    caseId: this.state.caseId,
                    savedAt: saveData.savedAt,
                    currentScene: this.state.currentScene
                });
                
                const now = Date.now();
                if (now - this.state.lastSaveLogTime >= CONFIG.LOG.SAVE_LOG_DEBOUNCE) {
                    this.addLog("[系统] 游戏状态已自动保存。", "sys");
                    this.state.lastSaveLogTime = now;
                }
            } catch (e) {
                this.addLog("[系统] 保存失败: 存储空间不足。", "error");
            }
        },

        /**
         * 更新存档索引
         */
        updateSaveIndex(caseId, data) {
            try {
                const indexStr = localStorage.getItem(CONFIG.SAVE_INDEX_KEY);
                const index = indexStr ? JSON.parse(indexStr) : {};
                index[caseId] = data;
                localStorage.setItem(CONFIG.SAVE_INDEX_KEY, JSON.stringify(index));
            } catch (e) {
                console.error('更新存档索引失败', e);
            }
        },

        /**
         * 获取存档索引
         */
        getSaveIndex() {
            try {
                const indexStr = localStorage.getItem(CONFIG.SAVE_INDEX_KEY);
                return indexStr ? JSON.parse(indexStr) : {};
            } catch (e) {
                return {};
            }
        },

        /**
         * 清除存档
         */
        clearSave() {
            const saveKey = this.state.caseId === 'default' 
                ? CONFIG.SAVE_KEY 
                : CONFIG.getCaseSaveKey(this.state.caseId);
            localStorage.removeItem(saveKey);
            
            // 从索引中移除
            const index = this.getSaveIndex();
            delete index[this.state.caseId];
            localStorage.setItem(CONFIG.SAVE_INDEX_KEY, JSON.stringify(index));
            
            this.addLog("[系统] 存档已清除。", "sys");
        },

        /**
         * 确认清除存档
         */
        confirmClearSave() {
            if (confirm('确定要清除该案件存档数据吗？此操作不可恢复。')) {
                const saveKey = this.state.caseId === 'default' 
                    ? CONFIG.SAVE_KEY 
                    : CONFIG.getCaseSaveKey(this.state.caseId);
                localStorage.removeItem(saveKey);
                
                const index = this.getSaveIndex();
                delete index[this.state.caseId];
                localStorage.setItem(CONFIG.SAVE_INDEX_KEY, JSON.stringify(index));
                
                alert('存档已清除，游戏将重新开始。');
                location.reload();
            }
        },

        /**
         * 手动检查更新
         */
        manualCheckUpdate() {
            const syncData = localStorage.getItem(CONFIG.EDITOR_SYNC.SYNC_KEY);
            const syncTimestamp = localStorage.getItem(CONFIG.EDITOR_SYNC.SYNC_TIMESTAMP_KEY);

            if (syncData && syncTimestamp) {
                const newData = JSON.parse(syncData);
                if (JSON.stringify(this.state.data) !== JSON.stringify(newData)) {
                    this.showEditorUpdatePrompt(newData, parseInt(syncTimestamp));
                    return;
                }
            }
            this.addLog(`未检测到编辑器更新，或数据已过期。`, "info");
        },

        /**
         * 执行推演
         */
        executeInference() {
            const currentIds = Object.values(this.state.matrix).flat().sort();
            if (currentIds.length === 0) {
                return this.addLog("推演中止：矩阵未载入任何逻辑节点。", "error");
            }

            const matched = this.state.data.endings.find(ending => {
                if (ending.recipe.length !== currentIds.length) return false;
                const sortedRecipe = [...ending.recipe].sort();
                return sortedRecipe.every((val, index) => val === currentIds[index]);
            });

            if (matched) {
                this.addLog(`[逻辑闭合已确认: ${escapeHtml(matched.name)}]`, "cmd");

                if (!this.state.achievedEndings.includes(matched.id)) {
                    this.state.achievedEndings.push(matched.id);
                    this.saveGame();
                }

                if (matched.isTrueCapture) {
                    this.triggerTrueCapture(matched);
                } else {
                    this.addLog(`>> ${this.processTextWithClues(matched.message)}`, "info");
                    const history = document.getElementById('endings-history');
                    if (!document.getElementById(`hist-${CSS.escape(matched.id)}`)) {
                        const div = document.createElement('div');
                        div.id = `hist-${matched.id}`;
                        // 移除内联样式，使用 CSS 样式
                        div.innerHTML = `● <b>达成</b>：${escapeHtml(matched.name)}`;
                        history.appendChild(div);
                    }
                }
            } else {
                this.addLog("推演失败：当前的逻辑节点无法形成因果环。", "error");
            }
        },

        /**
         * 触发真结局
         */
        triggerTrueCapture(ending) {
            if (!this.state.achievedEndings.includes(ending.id)) {
                this.state.achievedEndings.push(ending.id);
                this.saveGame();
            }

            const overlay = document.getElementById('capture-overlay');
            overlay.style.display = 'flex';

            // 动态更新真名字体
            const truenameTitle = document.getElementById('truename-title');
            if (truenameTitle) {
                if (ending.truename) {
                    truenameTitle.innerText = `『${ending.truename}』`;
                } else {
                    // 备用方案：从name字段解析
                    const match = ending.name.match(/真名捕获[：:]\s*(.+)/);
                    if (match) {
                        truenameTitle.innerText = `『${match[1]}』`;
                    }
                }
            }

            setTimeout(() => {
                document.getElementById('truename-block').style.display = 'flex';
            }, CONFIG.DELAYS.TRUENAME_BLOCK);

            const container = document.getElementById('story-container');
            container.innerHTML = "";

            ending.lines.forEach((line) => {
                const p = document.createElement('p');
                p.className = 'story-line';
                p.innerText = line.text;
                container.appendChild(p);
                setTimeout(() => p.classList.add('active'), line.delay + CONFIG.DELAYS.STORY_LINE);
            });

            if (ending.message?.trim()) {
                const lastLine = ending.lines[ending.lines.length - 1];
                const messageDelay = lastLine.delay + CONFIG.DELAYS.STORY_LINE + 1500;

                setTimeout(() => {
                    const separator = document.createElement('div');
                    separator.className = 'story-separator';
                    container.appendChild(separator);

                    const messageContainer = document.createElement('div');
                    messageContainer.className = 'story-line story-message';
                    messageContainer.innerHTML = this.processTextWithClues(ending.message);
                    container.appendChild(messageContainer);

                    setTimeout(() => messageContainer.classList.add('active'), CONFIG.DELAYS.STORY_LINE);
                }, messageDelay);
            }

            setTimeout(() => {
                document.getElementById('capture-actions').style.opacity = '1';
            }, CONFIG.DELAYS.CAPTURE_ACTIONS);
        },

        /**
         * 执行最终捕获
         */
        performFinalCapture() {
            const overlay = document.getElementById('capture-overlay');
            overlay.classList.add('critical-glitch');

            document.getElementById('final-capture-btn').style.display = 'none';

            const tnBlock = document.getElementById('truename-block');
            tnBlock.style.animation = 'none';
            tnBlock.style.opacity = '0.4';
            tnBlock.style.filter = 'blur(2px)';

            document.getElementById('story-container').style.opacity = '0.2';
            document.getElementById('status-line').innerText = "[ ! 因果已锚定：主体正在解离 ! ]";
            document.getElementById('status-line').style.color = "#cf222e";

            setTimeout(() => {
                document.getElementById('disconnect-notice').style.display = 'block';
            }, CONFIG.DELAYS.GLITCH_NOTICE);
        },

        /**
         * 切换Tab
         */
        switchTab(tabName) {
            const mainSystem = document.getElementById('main-system');
            if (mainSystem) {
                mainSystem.setAttribute('data-tab', tabName);
            }

            document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
                const isActive = btn.dataset.tab === tabName;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive.toString());
            });
        },

        /**
         * 切换纯观图模式 / 图文混合模式
         */
        togglePureView() {
            const container = document.getElementById('sceneContainer');
            const btn = document.querySelector('.btn-view-toggle');
            
            if (!container || !btn) return;
            
            if (container.classList.contains('pure-view-mode')) {
                container.classList.remove('pure-view-mode');
                btn.innerText = '[ EYE_LOOK // 独占视域 ]';
            } else {
                container.classList.add('pure-view-mode');
                btn.innerText = '[ TEXT_ON // 恢复文本 ]';
            }
        }
    };

    return Engine;
}

export { createEngine };
export default createEngine;
