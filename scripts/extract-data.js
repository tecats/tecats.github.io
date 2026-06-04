/**
 * T.E.C-OS 数据提取脚本
 * 从 index.html 中提取 initialProjectData 并保存为 JSON
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'index.html');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'game.json');

console.log('[提取] 开始提取游戏数据...');

// 读取原始文件
let content = fs.readFileSync(INPUT_FILE, 'utf8');
console.log('[提取] 文件读取成功，大小:', (content.length / 1024 / 1024).toFixed(2), 'MB');

// 查找数据范围
const startMarker = 'const initialProjectData = {';
const startIndex = content.indexOf(startMarker);
const endIndex = content.lastIndexOf('};');

console.log('[提取] 数据范围:', startIndex, '-', endIndex);

// 提取数据
let dataString = content.substring(startIndex, endIndex + 2);
console.log('[提取] 原始数据长度:', dataString.length);

// ==================== 修复: 正确处理 Base64 数据 ====================

// 策略: 先用占位符替换所有 avatar Base64 数据，移除注释后，再恢复

console.log('[提取] 提取 Base64 数据...');

// 收集所有 avatar 数据
const avatarMatches = [];
let tempData = dataString.replace(/"avatar":\s*"([^"]+)"/g, (match, p1) => {
    const placeholder = `__AVATAR_PLACEHOLDER_${avatarMatches.length}__`;
    avatarMatches.push(p1);
    return `"avatar": "${placeholder}"`;
});

console.log('[提取] 找到', avatarMatches.length, '个 avatar');

// 移除单行注释 (在 avatar 占位符替换后，Base64 数据中的 // 不会影响)
let cleaned = tempData.replace(/\/\/[^\n]*/g, '');
console.log('[提取] 移除 // 注释后长度:', cleaned.length);

// 移除多行注释
cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
console.log('[提取] 移除 /* */ 注释后长度:', cleaned.length);

// 恢复 avatar Base64 数据
console.log('[提取] 恢复 Base64 数据...');
cleaned = cleaned.replace(/__AVATAR_PLACEHOLDER_(\d+)__/g, (match, idx) => {
    return avatarMatches[parseInt(idx)];
});

console.log('[提取] 恢复后长度:', cleaned.length);

// 移除 undefined
cleaned = cleaned.replace(/:\s*undefined/g, ': null');

// 移除尾随逗号
cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

// 保存清理后的代码用于调试
fs.writeFileSync(__dirname + '/../data/cleaned.txt', cleaned, 'utf8');
console.log('[提取] 已保存清理代码到 cleaned.txt');

// 找到第一个 { 并提取 JSON 部分
// 确保从 "const initialProjectData = {" 后面的 { 开始
const constDecl = 'const initialProjectData = ';
const firstBrace = cleaned.indexOf('{', cleaned.indexOf(constDecl) + constDecl.length);
const jsonPart = cleaned.substring(firstBrace);
console.log('[提取] JSON 部分长度:', jsonPart.length);

// 使用花括号匹配来确定 JSON 的结束位置
let braceCount = 0;
let jsonEnd = -1;
for (let i = 0; i < jsonPart.length; i++) {
    const char = jsonPart[i];
    if (char === '{') braceCount++;
    if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
        }
    }
}

const pureJson = jsonPart.substring(0, jsonEnd);
console.log('[提取] 纯 JSON 长度:', pureJson.length);

// 尝试解析
try {
    console.log('[提取] 尝试 JSON.parse...');
    const data = JSON.parse(pureJson);
    
    console.log('[提取] 解析成功!');
    console.log('[提取] 场景数量:', Object.keys(data.scenes || {}).length);
    console.log('[提取] 物品数量:', Object.keys(data.items || {}).length);
    console.log('[提取] 角色数量:', Object.keys(data.chars || {}).length);
    console.log('[提取] 线索数量:', Object.keys(data.clues || {}).length);
    console.log('[提取] 结局数量:', (data.endings || []).length);
    
    // 写入文件
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('[提取] 数据已保存到:', OUTPUT_FILE);
    console.log('[提取] 文件大小:', (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2), 'MB');
    console.log('[提取] 完成!');
    
} catch (e) {
    console.error('[提取] 解析错误:', e.message);
    
    // 找出错误位置
    const posMatch = e.message.match(/position (\d+)/);
    if (posMatch) {
        const pos = parseInt(posMatch[1]);
        console.log('[提取] 错误位置:', pos);
        console.log('[提取] 上下文:');
        console.log(jsonPart.substring(Math.max(0, pos-100), pos+100));
    }
    
    process.exit(1);
}
