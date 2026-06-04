/**
 * T.E.C-OS 主入口文件
 * 负责加载游戏数据和初始化引擎
 */

import { createEngine } from './engine.js';
import { CONFIG } from './config.js';

// ========================== URL参数解析 ==========================

/**
 * 解析URL参数
 */
function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        caseId: params.get('case') || 'default',
        fresh: params.get('fresh') === '1'
    };
}

// 存储URL参数供Engine使用
const urlParams = parseUrlParams();
window.__GAME_CASE_ID__ = urlParams.caseId;
window.__GAME_FRESH__ = urlParams.fresh;

// ========================== 游戏数据加载器 ==========================

/**
 * 获取当前页面对应的游戏数据文件名
 */
function getDataFileName() {
    const caseId = urlParams.caseId;

    const dataMap = {
        'A-001': 'game-a001.json',
        'A-002': 'game-a002.json',
    };

    return dataMap[caseId] || 'game-a001.json';
}

/**
 * 加载游戏数据
 * 支持从外部JSON文件或内联数据加载
 */
async function loadGameData() {
    // 根据当前HTML文件名确定数据文件
    const dataFile = getDataFileName();
    
    // 构建数据路径（支持多种路径格式）
    const basePath = window.location.pathname;
    const lastSlash = basePath.lastIndexOf('/');
    const dirPath = basePath.substring(0, lastSlash + 1);
    const dataPath = dirPath + `data/${dataFile}`;
    
    console.log('[游戏] 当前路径:', window.location.pathname);
    console.log('[游戏] 数据文件:', dataFile);
    console.log('[游戏] 数据路径:', dataPath);
    
    // 尝试从外部JSON文件加载
    try {
        const response = await fetch(dataPath);
        console.log('[游戏] 请求状态:', response.status, response.statusText);
        
        if (response.ok) {
            const text = await response.text();
            const data = JSON.parse(text);
            console.log('[游戏] 已从外部文件加载游戏数据:', dataFile);
            console.log('[游戏] 场景数量:', Object.keys(data.scenes || {}).length);
            return data;
        } else {
            console.warn('[游戏] 数据文件请求失败:', response.status, response.statusText);
        }
    } catch (e) {
        console.error('[游戏] 外部数据加载异常:', e.message);
    }

    // 尝试使用相对路径
    const relativePath = `./data/${dataFile}`;
    console.log('[游戏] 尝试相对路径:', relativePath);
    
    try {
        const response = await fetch(relativePath);
        if (response.ok) {
            const text = await response.text();
            const data = JSON.parse(text);
            console.log('[游戏] 使用相对路径加载成功:', relativePath);
            return data;
        }
    } catch (e) {
        console.warn('[游戏] 相对路径加载失败:', e.message);
    }

    // 回退到内联数据（如果存在）
    if (typeof window.GAME_DATA !== 'undefined') {
        console.log('[游戏] 使用内联游戏数据');
        return window.GAME_DATA;
    }

    console.error('[游戏] 无法加载游戏数据 - 所有路径都失败');
    return null;
}

// ========================== 初始化 ==========================

/**
 * 初始化游戏
 */
async function initGame() {
    console.log(`[游戏] T.E.C-OS ${CONFIG?.VERSION || 'v4.11.0'} 加载中...`);

    // 显示加载状态
    const bootOverlay = document.getElementById('boot-overlay');
    const bootTitle = document.getElementById('boot-title');
    if (bootTitle) {
        bootTitle.textContent = '[LOADING...]';
    }

    const gameData = await loadGameData();
    
    if (!gameData) {
        document.body.innerHTML = `
            <div style="padding:40px;text-align:center;font-family:monospace;">
                <h2 style="color:#ff4444;">游戏数据加载失败</h2>
                <p>请检查:</p>
                <ul style="text-align:left;display:inline-block;">
                    <li>1. data/game.json 文件是否存在</li>
                    <li>2. JSON 格式是否有效 (可用 JSONLint 验证)</li>
                    <li>3. 浏览器控制台是否有错误</li>
                </ul>
                <br>
                <button onclick="location.reload()" style="padding:10px 30px;cursor:pointer;">
                    重新加载
                </button>
            </div>
        `;
        return;
    }

    // 创建并初始化引擎
    const Engine = createEngine(gameData);

   // 初始化引擎 (关键！之前缺少这一步)
    Engine.init();

    // 恢复boot标题
    if (bootTitle) {
        bootTitle.textContent = 'T.E.C-OS [V5.0.0]';
    }

    // 绑定Tab切换功能
    document.addEventListener('DOMContentLoaded', () => {
        const tabNav = document.querySelector('.mobile-tab-nav');
        if (tabNav) {
            tabNav.addEventListener('click', (e) => {
                const btn = e.target.closest('.mobile-tab-btn');
                if (btn?.dataset.tab && window.Engine) {
                    window.Engine.switchTab(btn.dataset.tab);
                }
            });
        }
    });

    console.log('[游戏] 初始化完成，等待用户点击...');
}

// 启动游戏
initGame().catch(err => {
    console.error('[游戏] 初始化错误:', err);
});
