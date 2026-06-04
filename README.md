# T.E.C-OS v5.2.0 更新记录

## 🆕 v5.2.0 更新内容 (2026-05-22)

### 全面UI风格统一（浅色明亮主题）

#### 游戏页面全新设计
- ✅ **index.html** - 首页启动界面：白色卡片 + 蓝色按钮
- ✅ **cases.html** - 案件档案库：卡片化设计，圆角阴影
- ✅ **game.html** - 统一游戏界面（通过 ?case=A-001 / A-002 区分案件）
- ✅ **css/main.css** - 主样式文件：全面重构

#### 配色方案更新（GitHub 风格）
| 元素 | 旧颜色 | 新颜色 |
|------|--------|--------|
| 背景 | #e0e0e0（灰色） | #f6f8fa（浅灰） |
| 强调色 | #0066cc | #0969da（GitHub 蓝） |
| 卡片 | 无边框 | 白色 + 圆角 + 阴影 |
| 文字 | #333 | #24292f（深灰黑） |
| 警告 | #cc3333 | #cf222e（红色） |

#### 场景文字可读性优化
- ✅ 字号增大：15px → 16px（PC端）/ 17px（移动端）
- ✅ 行高增加：1.9 → 2.0（更易阅读）
- ✅ 背景渐变优化：多段渐变，更平滑过渡
- ✅ 文字阴影增强：0 1px 2px → 0 1px 3px + 透明度 0.95
- ✅ 颜色加深：#1a1a1a → #111827

#### 结局条目样式优化
- ✅ 字号增大：13px → 15px
- ✅ 添加淡蓝色背景：rgba(9, 105, 218, 0.04)
- ✅ 左侧蓝色装饰线：border-left: 3px solid #0969da
- ✅ 圆角：6px
- ✅ 字重调整：font-weight: 500

#### 面板标题对齐修复
- ✅ 所有面板标题固定高度：48px
- ✅ 按钮 line-height: 1（消除额外高度）
- ✅ 圆角统一：8px（大卡片）
- ✅ 阴影统一：0 1px 3px rgba(0, 0, 0, 0.08)

#### 移动端适配优化
- ✅ 场景文字独立优化（17px 字号）
- ✅ 背景渐变方向调整（垂直渐变）
- ✅ Tab 切换布局完善

#### 代码清理
- ✅ 移除无用的测试文件（generate-test-image.html）
- ✅ 移除无用的脚本（generate-scene-image.js）
- ✅ 更新 config.js 颜色配置为新配色方案
- ✅ 修复 JS 中硬编码的 CSS 变量引用

#### 剧情编辑工具
- ✅ **保持暗色赛博朋克风格**（#00ff41 荧光绿）
- ✅ 功能完整，无需调整

### 技术改进
- ✅ 固定高度 vs 最小高度：从 min-height 改为 height 确保严格对齐
- ✅ CSS Grid 布局优化
- ✅ Flexbox 垂直居中统一
- ✅ 响应式设计完善

---

*(以下为历史版本记录)*

## 📁 当前目录结构

```
tecats.github.io/
├── index.html              # ✅ 网站入口（浅色明亮主题）
├── cases.html             # ✅ 案件档案库页面（浅色明亮主题）
├── game.html              # ✅ 统一游戏页面（通过 URL 参数区分案件）
├── 剧情编辑工具ver2.0.html  # ✅ 剧情编辑器（暗色赛博朋克风格）
├── README.md               # ✅ 本文档
│
├── css/                    # ✅ CSS目录
│   └── main.css            # ✅ 主样式文件（浅色明亮主题）
│
├── js/                     # ✅ JavaScript目录
│   ├── config.js           # ✅ 配置常量（v5.2.0 配色方案）
│   ├── utils.js           # ✅ 工具函数
│   ├── gameplay.js         # ✅ 玩法管理器
│   ├── engine.js           # ✅ 核心引擎
│   └── main.js             # ✅ 主入口
│
├── data/                   # ⚠️ 游戏数据目录
│   ├── game-a001.json     # ⚠️ A-001 游戏数据
│   └── game-a002.json     # ⚠️ A-002 游戏数据
│
├── images/                  # ✅ 游戏图片目录
│   └── （场景、角色、线索图片）
```

## 🚀 使用方法

### 快速启动

1. 启动本地服务器：
```bash
# Python 3
python -m http.server 3000

# Node.js (npx)
npx serve -p 3000
```

2. 访问：`http://localhost:3000/index.html`

### 游戏流程

```
index.html (欢迎页)
  ↓
cases.html (案件档案库 - 选择案件)
  ↓
game.html?case=A-001 (游戏页面 - A-001)
```

### 多案件架构

统一游戏页面 `game.html` 通过 URL 参数 `case` 区分案件：
- `A-001` → game.html?case=A-001，数据文件 `data/game-a001.json`
- `A-002` → game.html?case=A-002，数据文件 `data/game-a002.json`
- 存档键格式：`causal_os_case_{caseId}`

## 🔧 扩展游戏内容

### 添加新场景
在 `data/game-a001.json` 的 `scenes` 对象中添加：

```json
"SCENE_NEW": {
    "title": "场景名称",
    "content": "场景内容 [item:ITEM_id]...",
    "desc": "简短描述",
    "hiddenClue": {
        "text": "隐藏线索 [clue:CLUE_id]",
        "ids": ["CLUE_id"]
    }
}
```

### 添加新结局
在 `data/game-a001.json` 的 `endings` 数组中添加：

```json
{
    "id": "END_EXAMPLE",
    "name": "结局名称",
    "recipe": ["CLUE_ID_1", "CLUE_ID_2"],
    "isTrueCapture": false,
    "message": "结局剧情描述..."
}
```

### 创建新案件

增加一个新案件只需改动 3 个文件。

#### 步骤1：准备数据文件 `data/game-a003.json`

在 `data/` 目录下新建 JSON 文件。建议先用剧情编辑器打开现有案件（如 `game-a001.json`），修改内容后用「导出 JSON 数据」保存为新文件。

```
data/
  game-a001.json   ← A-001
  game-a002.json   ← A-002
  game-a003.json   ← A-003（新增）
```

#### 步骤2：注册数据路由 `js/main.js`

在 `getDataFileName()` 的 `dataMap` 中添加一行映射：

```javascript
const dataMap = {
    'A-001': 'game-a001.json',
    'A-002': 'game-a002.json',
    'A-003': 'game-a003.json',   // ← 新增
};
```

#### 步骤3：案件档案库添加入口 `cases.html`

把其中一个锁定卡片替换为可用的案件卡片：

```html
<a class="case-card" data-case="A-003" href="game.html?case=A-003&fresh=1">
    <div class="card-header">
        <div class="card-tags">
            <span class="card-tag tag-type">区域</span>
            <span class="card-tag tag-level-1">初级</span>
        </div>
        <span class="card-warning">▼</span>
    </div>
    <div class="card-body">
        <div class="card-name">新案件名称</div>
        <div class="card-desc">异动区域</div>
    </div>
    <div class="card-footer">
        <span class="card-id">A-003</span>
        <span class="card-arrow">进入 ▶</span>
    </div>
</a>
```

#### 总结

| 文件 | 改动 |
|------|------|
| `data/game-a003.json` | 新建 JSON 数据文件 |
| `js/main.js` | +1 行注册路由 |
| `cases.html` | 替换一个锁定卡片 |

核心入口统一为 `game.html?case=A-003`，存档自动使用 key `causal_os_case_A-003`，无需额外配置。

##  版本信息

- **游戏版本**: v5.2.0
- **更新日期**: 2026年5月22日
- **前一版本**: v5.1.1
- **重构日期**: 2026年5月11日

## 🆕 v5.1.1 更新内容 (2026-05-20)

### 图片存储优化

#### 头像图片外置
- ✅ 将角色头像从 Base64 内联存储改为外部文件路径存储
- ✅ `game-a002.json` 文件体积从 ~10MB 压缩至 ~60KB（约 99.4% 压缩率）
- ✅ 头像文件提取到 `images/` 文件夹（如 `avatar_CHARS_JS.png`）
- ✅ 剧情编辑工具上传头像时自动生成路径引用

#### 图片路径格式
```json
{
  "chars": {
    "CHARS_JS": {
      "name": "角色名",
      "avatar": "images/avatar_CHARS_JS.png"
    }
  }
}
```

### 出示命令优化

#### 双向匹配支持
- ✅ `出示 手电筒 黑影` 和 `出示 黑影 手电筒` 效果相同
- ✅ 系统自动判断哪个是物品（玩家拥有），哪个是目标
- ✅ 支持对角色和场景物品使用

#### 逻辑修复
- ✅ 修复角色反应字段不一致问题（支持 `itemReactions`/`reactions` 字段）
- ✅ 修复错误提示逻辑，正确区分“对象不存在”和“未拥有”

#### 支持的交互类型
| 物品类型 | 作为物品 | 作为目标 |
|---------|---------|---------|
| inventory 物品 | ✅ | ✅ |
| 角色 (char) | ❌ | ✅ |
| 场景物品 | ❌ | ✅ |

## 🆕 v5.1.0 更新内容 (2026-05-19)

### 玩法系统优化

#### 密码/组合解锁合并
- ✅ 将 `password`（密码解锁）和 `comboLock`（组合锁）合并为统一的 `password` 玩法
- ✅ 通过 `digits` 参数自动区分显示样式：
  - 不设置位数 → “加密锁定” + “输入授权密钥进行逻辑解构”
  - 设置位数 → “组合锁” + “输入X位组合码”
- ✅ 保留旧数据兼容性：`comboLock` 类型自动使用新逻辑
- ✅ 编辑工具中整合为“密码/组合解锁”选项

#### 条件触发跳转场景
- ✅ 在物品的“出示反应”条件触发配置中添加了“跳转场景”功能
- ✅ 支持在条件满足时自动跳转到指定场景
- ✅ 与触发标记、特殊文本组合使用

**条件触发配置示例**：
```json
{
  "conditionFlags": {
    "ITEM_KEY": {
      "flag": "door_tie",
      "text": "太亮了！！！",
      "scene": "SCENE_SECRET"
    }
  }
}
```

### 数据文件自动加载
- ✅ 根据 URL 参数 `case` 自动加载对应的游戏数据
- ✅ `?case=A-001` → `data/game-a001.json`
- ✅ `?case=A-002` → `data/game-a002.json`
- ✅ 默认 → `data/game-a001.json`

### 服务器优化
- ✅ 修复URL查询参数处理问题（?case=xxx&fresh=1）

### 案件链接优化
- ✅ 修复案件档案库中的跳转问题

## 🆕 v5.0.0 更新内容 (2026-05-13)

### 文件结构重构
| 原文件名 | 新文件名 | 说明 |
|---------|---------|------|
| welcome.html | index.html | 欢迎页改为首页入口 |
| index.html（旧） | game.html | 游戏逻辑抽取为统一游戏页面，支持 ?case= 多案件 |

### 页面优化
- ✅ 按钮中文化：“CONNECT_CORE” → “接入因果核心”
- ✅ 按钮样式统一：移除加粗、统一间距
- ✅ 新增“返回档案库”按钮
- ✅ 案件档案库：保留前2个案件，其他显示“档案未解密”

### 游戏内容优化
- ✅ 真名捕获提示：`[ ! FATAL_ERROR: GHOST_SHELL_DECOUPLING ! ]` → `[ ! 因果已锚定：主体正在解离 ! ]`

### 多案件架构
- ✅ 统一游戏页面 `game.html`，通过 URL 参数 `?case=` 区分案件
- ✅ 存档通过 `caseId` 区分，互不干扰

### 矩阵状态提示优化
- ✅ 新增 `analyzeMatrixState()` 方法，实时分析矩阵状态
- ✅ 线索放入/移除时自动显示进度提示
- ✅ 显示各结局的匹配进度和未归因类型
- ✅ 真名捕获始终显示在第一位
- ✅ 支持重复类型提示（如“未归因类型：视觉、视觉”）
- ✅ 文案优化：“五感已完全归因” → “已完全归因”

**提示格式示例**：
```
[逻辑节点同步完成]
→ 真名捕获：2/5，未归因类型：触觉、嗅觉、味觉
→ 因果链#1：1/3，未归因类型：视觉
→ 因果链#2：2/5，未归因类型：听觉、触觉、嗅觉
```

---

*重构完成！如有问题请提交 Issue。*

