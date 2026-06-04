/**
 * T.E.C-OS 配置常量
 * 游戏全局配置和常量定义
 */

export const CONFIG = {
    VERSION: 'v5.0.0',
    SAVE_KEY: 'causal_os_save',
    SAVE_INDEX_KEY: 'causal_os_save_index',

    /**
     * 获取案件存档的 localStorage key
     * @param {string} caseId - 案件ID
     * @returns {string} localStorage key
     */
    getCaseSaveKey(caseId) {
        return `causal_os_case_${caseId}`;
    },

    // 颜色配置（浅色明亮主题）
    COLORS: {
        GREEN: '#0969da',       /* GitHub 蓝色 */
        DARK: '#656d76',        /* 中性灰 */
        WARN: '#bf8700',        /* 橙色 */
        CRIT: '#cf222e',        /* 红色 */
        TRUENAME: '#8250df',    /* 紫色 */
        BG: '#f6f8fa',          /* 浅灰背景 */
        CHAR: '#0969da',        /* 角色蓝 */
        ITEM: '#1a7f37',        /* 物品绿 */
        LOC: '#8250df',         /* 场景紫 */
        CYAN: '#0891b2',        /* 青色 */
        PINK: '#be185d'         /* 粉色 */
    },

    // 动画延迟配置（毫秒）
    DELAYS: {
        STORY_LINE: 1500,
        CAPTURE_ACTIONS: 6000,
        TRUENAME_BLOCK: 800,
        GLITCH_NOTICE: 400
    },

    // 日志配置
    LOG: {
        BUFFER_FLUSH_INTERVAL: 50,
        MAX_BUFFER_SIZE: 500,
        SAVE_LOG_DEBOUNCE: 2000
    },

    // 菜单配置
    MENU: {
        ESTIMATED_WIDTH: 160,
        ESTIMATED_HEIGHT: 120,
        BOUNDARY_PADDING: 10
    },

    // 编辑器同步配置
    EDITOR_SYNC: {
        SYNC_KEY: 'causal_os_editor_data',
        SYNC_TIMESTAMP_KEY: 'causal_os_editor_timestamp',
        CHANNEL_NAME: 'causal_os_sync',
        EXPIRE_TIME: 3600000 // 1小时
    }
};

export default CONFIG;
