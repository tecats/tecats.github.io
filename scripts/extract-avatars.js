/**
 * 提取JSON中的Base64头像并保存为文件
 */

const fs = require('fs');
const path = require('path');

// 配置
const INPUT_FILE = '../data/game01.json';
const OUTPUT_DIR = '../images';

function extractAvatars() {
    try {
        // 读取JSON文件
        const jsonContent = fs.readFileSync(path.join(__dirname, INPUT_FILE), 'utf-8');
        const data = JSON.parse(jsonContent);
        
        // 确保输出目录存在
        if (!fs.existsSync(path.join(__dirname, OUTPUT_DIR))) {
            fs.mkdirSync(path.join(__dirname, OUTPUT_DIR), { recursive: true });
            console.log(`创建目录: ${OUTPUT_DIR}`);
        }
        
        // 处理角色头像
        const chars = data.chars || {};
        let extractedCount = 0;
        let updatedChars = {};
        
        for (const [charId, charData] of Object.entries(chars)) {
            if (charData.avatar && charData.avatar.startsWith('data:image/')) {
                // 提取Base64数据
                const base64Data = charData.avatar.split(',')[1];
                const mimeType = charData.avatar.split(';')[0].split(':')[1];
                const ext = mimeType.split('/')[1];
                
                // 生成文件名
                const fileName = `avatar_${charId}.${ext}`;
                const filePath = `images/${fileName}`;
                
                // 保存图片文件
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(path.join(__dirname, OUTPUT_DIR, fileName), buffer);
                console.log(`提取头像: ${charId} -> ${filePath}`);
                
                // 更新为路径引用
                updatedChars[charId] = { ...charData, avatar: filePath };
                extractedCount++;
            } else {
                updatedChars[charId] = charData;
            }
        }
        
        // 更新JSON数据
        data.chars = updatedChars;
        
        // 保存更新后的JSON
        const outputJsonPath = path.join(__dirname, INPUT_FILE);
        fs.writeFileSync(outputJsonPath, JSON.stringify(data, null, 4), 'utf-8');
        console.log(`\n处理完成！`);
        console.log(`提取头像数量: ${extractedCount}`);
        console.log(`更新后的JSON已保存到: ${INPUT_FILE}`);
        
    } catch (error) {
        console.error('处理失败:', error.message);
        process.exit(1);
    }
}

// 执行提取
extractAvatars();