/**
 * T.E.C-OS 玩法管理器
 * 注册和管理各种游戏玩法类型
 */

import { escapeHtml } from './utils.js';

class GameplayManager {
    constructor() {
        this.handlers = {};
    }

    /**
     * 注册玩法类型
     * @param {string} type - 玩法类型
     * @param {Object} handler - 玩法处理器
     */
    register(type, handler) {
        this.handlers[type] = handler;
    }

    /**
     * 获取已注册的玩法处理器
     * @param {string} type - 玩法类型
     * @returns {Object} 玩法处理器
     */
    getHandler(type) {
        return this.handlers[type];
    }

    /**
     * 执行玩法
     * @param {Object} engine - 引擎实例
     * @param {string} targetId - 目标ID
     * @param {Object} cmd - 命令对象
     * @param {Object} extraData - 额外数据
     * @returns {boolean} 是否执行成功
     */
    execute(engine, targetId, cmd, extraData = {}) {
        const handler = this.handlers[cmd.type];
        if (handler) {
            return handler.execute(engine, targetId, cmd, extraData);
        }
        engine.addLog(`未知玩法类型: ${cmd.type}`, "error");
        return false;
    }

    /**
     * 检查是否存在指定类型的处理器
     * @param {string} type - 玩法类型
     * @returns {boolean}
     */
    hasHandler(type) {
        return !!this.handlers[type];
    }
}

// 创建单例实例
const gameplayManager = new GameplayManager();

// ========================== 注册内置玩法 ==========================

// 密码/组合解锁玩法（合并版）
gameplayManager.register('password', {
    execute(engine, targetId, cmd) {
        if (cmd.requiredItem && !engine.state.inventory.includes(cmd.requiredItem)) {
            engine.addLog(cmd.failMessage || '缺少必要物品，无法操作。', 'error');
            return;
        }

        const isComboLock = cmd.digits && cmd.digits > 0;
        const digits = cmd.digits || null;
        const defaultTitle = `${isComboLock ? '组合锁' : '加密锁定'}: ${escapeHtml(engine.state.data.items[targetId].label)}`;
        const defaultBody = isComboLock ? `输入${digits}位组合码：` : '输入授权密钥进行逻辑解构：';

        engine.showModal({
            title: cmd.title || defaultTitle,
            body: cmd.prompt || defaultBody,
            hasInput: true,
            confirm: (val) => {
                if (val === cmd.value) {
                    engine.addLog(`[${isComboLock ? '组合匹配成功' : '密钥匹配成功'}]`, 'sys');
                    engine.closeModal();
                    if (cmd.onSuccess) engine.applyResults(cmd.onSuccess);
                } else {
                    engine.addLog(isComboLock ? '组合错误，请重试。' : '密钥校验失败：访问被拒绝。', 'error');
                }
            }
        });

        var inputEl = document.getElementById('modal-val');
        if (inputEl) {
            var composing = false;
            inputEl.addEventListener('compositionstart', function() { composing = true; });
            inputEl.addEventListener('compositionend', function() { composing = false; });
            inputEl.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !composing) {
                    e.preventDefault();
                    document.getElementById('modal-confirm').click();
                }
            });
        }
    }
});

// 兼容旧版comboLock（建议更新数据文件后移除）
gameplayManager.register('comboLock', gameplayManager.getHandler('password'));

// 文本显示玩法
gameplayManager.register('text', {
    execute(engine, targetId, cmd, extraData = {}) {
        engine.addLog(engine.processTextWithClues(cmd.value), "info", {
            image: extraData.image || null,
            audio: extraData.audio || null
        });
        if (cmd.results) engine.applyResults(cmd.results);
    }
});

// 对话玩法
gameplayManager.register('talk', {
    execute(engine, targetId, cmd) {
        const char = engine.state.data.chars[targetId];
        if (char) {
            const currentSceneId = engine.state.currentScene;
            let talkQueue = null;

            if (char.sceneTalks && char.sceneTalks[currentSceneId]?.length > 0) {
                talkQueue = char.sceneTalks[currentSceneId];
            } else if (char.defaultTalks?.length > 0) {
                talkQueue = char.defaultTalks;
            } else if (char.talkQueue?.length > 0) {
                talkQueue = char.talkQueue;
            }

            if (talkQueue) {
                if (engine.state.charTalkIndex[targetId] === undefined ||
                    engine.state.charTalkIndex[targetId] >= talkQueue.length) {
                    engine.state.charTalkIndex[targetId] = 0;
                }

                const currentTalk = talkQueue[engine.state.charTalkIndex[targetId]];
                engine.addLog(
                    engine.processTextWithClues(currentTalk.text),
                    "info",
                    {
                        avatar: char.avatar || null,
                        speaker: char.name,
                        image: currentTalk.image || null,
                        audio: currentTalk.audio || null
                    }
                );

                if (currentTalk.results) engine.applyResults(currentTalk.results);
                engine.state.charTalkIndex[targetId] =
                    (engine.state.charTalkIndex[targetId] + 1) % talkQueue.length;
            }
        }
    }
});

// 选择分支玩法
gameplayManager.register('choice', {
    execute(engine, targetId, cmd) {
        const options = cmd.options || [];
        const container = document.getElementById('modal-input-container');

        engine.showModal({
            title: cmd.title || "选择",
            body: cmd.prompt || "请选择：",
            hasInput: false,
            confirm: null
        });

        container.innerHTML = '';
        options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.className = 'boot-btn';
            btn.style.cssText = 'display: block; width: 100%; margin: 8px 0; text-align: left;';
            btn.innerText = escapeHtml(opt.label);
            btn.onclick = () => {
                engine.closeModal();
                if (opt.results) engine.applyResults(opt.results);
                if (opt.message) engine.addLog(engine.processTextWithClues(opt.message), "info");
            };
            container.appendChild(btn);
        });

        document.getElementById('modal-confirm').style.display = 'none';
        document.getElementById('modal-cancel').innerText = '取消';

        const originalCloseModal = engine.closeModal.bind(engine);
        engine.closeModal = function() {
            originalCloseModal();
            document.getElementById('modal-confirm').style.display = '';
            engine.closeModal = originalCloseModal;
        };
    }
});

// 物品记录玩法
gameplayManager.register('pickup', {
    execute(engine, targetId, cmd) {
        const itemData = engine.state.data.items[targetId];
        if (!itemData) {
            engine.addLog(`[记录失败] 物品不存在。`, "error");
            return;
        }

        if (!itemData.canBePicked) {
            engine.addLog(`[记录失败] 该物品无法记录。`, "error");
            return;
        }

        if (engine.state.inventory.includes(targetId)) {
            engine.addLog(`[记录失败] 该物品已在物品档案中。`, "warn");
            return;
        }

        engine.state.inventory.push(targetId);
        engine.addLog(`[记录成功] "${escapeHtml(itemData.label)}"已被记录在案。`, "sys");
        engine.saveGame();
    }
});

// 物品使用玩法
gameplayManager.register('useItem', {
    execute(engine, targetId, cmd) {
        const requiredItem = cmd.requiredItem;
        const hasItemInInventory = engine.state.inventory.includes(requiredItem);

        if (hasItemInInventory) {
            const successMessage = cmd.successMessage || '物品已使用。';
            engine.addLog(`[使用成功] ${engine.processTextWithClues(successMessage)}`, "sys");
            if (cmd.onSuccess) engine.applyResults(cmd.onSuccess);
        } else {
            const failMessage = cmd.failMessage || `没有合适的物品。`;
            engine.addLog(`[使用失败] ${escapeHtml(failMessage)}`, "error");
        }
    }
});

// 条件触发玩法
gameplayManager.register('conditional', {
    execute(engine, targetId, cmd) {
        const conditions = cmd.conditions || [];
        let allMet = true;
        let failedCondition = null;

        for (const cond of conditions) {
            if (cond.flag && !engine.state.gameFlags[cond.flag]) {
                allMet = false;
                failedCondition = cond;
                break;
            }
            if (cond.clue && !engine.state.foundClueIds.includes(cond.clue)) {
                allMet = false;
                failedCondition = cond;
                break;
            }
        }

        if (allMet) {
            engine.addLog(engine.processTextWithClues(cmd.successMessage || '条件满足。'), "sys");
            if (cmd.onSuccess) engine.applyResults(cmd.onSuccess);
        } else {
            engine.addLog(
                engine.processTextWithClues(failedCondition?.failMessage || cmd.failMessage || '条件不满足。'),
                "error"
            );
        }
    }
});

export { gameplayManager };
