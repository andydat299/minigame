const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
    }

    init() {
        const dbPath = path.join(__dirname, 'bot.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Lỗi kết nối database:', err);
            } else {
                console.log('✅ Đã kết nối database SQLite');
                this.createTables();
            }
        });
    }

    createTables() {
        // Bảng users
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT,
                balance INTEGER DEFAULT 1000,
                level INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                daily_claimed DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Bảng game_stats
        this.db.run(`
            CREATE TABLE IF NOT EXISTS game_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                game_name TEXT,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                total_games INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Bảng shop_items
        this.db.run(`
            CREATE TABLE IF NOT EXISTS shop_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                description TEXT,
                price INTEGER,
                category TEXT,
                emoji TEXT
            )
        `);

        // Bảng user_inventory
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                item_id INTEGER,
                quantity INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (item_id) REFERENCES shop_items (id)
            )
        `);

        // Bảng user_pickaxes cho mining game
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_pickaxes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE,
                level INTEGER DEFAULT 1,
                durability INTEGER DEFAULT 50,
                max_durability INTEGER DEFAULT 50,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Bảng battle_states cho adventure game
        this.db.run(`
            CREATE TABLE IF NOT EXISTS battle_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE,
                boss_id INTEGER,
                player_hp INTEGER,
                boss_hp INTEGER,
                turn INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Bảng user_achievements
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                achievement_id TEXT,
                claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, achievement_id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Bảng user_quests
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_quests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                quest_id TEXT,
                quest_type TEXT CHECK(quest_type IN ('daily', 'weekly')),
                claimed BOOLEAN DEFAULT 0,
                claimed_at DATETIME,
                reset_date DATE DEFAULT (date('now')),
                UNIQUE(user_id, quest_id, quest_type),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Bảng user_trivia_questions cho slash command trivia
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_trivia_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE,
                question_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Bảng user_guess_games cho slash command guess
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_guess_games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE,
                target_number INTEGER,
                attempts INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Bảng sicbo_sessions cho tài xỉu
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sicbo_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT,
                round_number INTEGER,
                dice1 INTEGER,
                dice2 INTEGER,
                dice3 INTEGER,
                total INTEGER,
                result TEXT CHECK(result IN ('tai', 'xiu', 'hoa')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        this.insertDefaultItems();
    }

    insertDefaultItems() {
        const items = [
            ['🎲', 'Lucky Dice', 'Tăng 20% cơ hội thắng game may rủi', 500, 'boost'],
            ['💎', 'Diamond', 'Vật phẩm quý hiếm', 1000, 'treasure'],
            ['🍀', 'Four Leaf Clover', 'Tăng 15% cơ hội thắng mọi game', 800, 'boost'],
            ['⚡', 'Lightning Bolt', 'Giảm thời gian chờ daily', 300, 'utility'],
            ['🏆', 'Trophy', 'Biểu tượng danh tiếng', 2000, 'trophy']
        ];

        items.forEach(item => {
            this.db.run(
                'INSERT OR IGNORE INTO shop_items (emoji, name, description, price, category) VALUES (?, ?, ?, ?, ?)',
                item
            );
        });
    }

    getUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    createUser(userId, username) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)',
                [userId, username],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    updateUserBalance(userId, amount) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET balance = balance + ? WHERE id = ?',
                [amount, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    updateUserXP(userId, xp) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET xp = xp + ? WHERE id = ?',
                [xp, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    getGameStats(userId, gameName) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM game_stats WHERE user_id = ? AND game_name = ?',
                [userId, gameName],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    updateGameStats(userId, gameName, result) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO game_stats (user_id, game_name, wins, losses, draws, total_games)
                VALUES (?, ?, 
                    COALESCE((SELECT wins FROM game_stats WHERE user_id = ? AND game_name = ?), 0) + ?,
                    COALESCE((SELECT losses FROM game_stats WHERE user_id = ? AND game_name = ?), 0) + ?,
                    COALESCE((SELECT draws FROM game_stats WHERE user_id = ? AND game_name = ?), 0) + ?,
                    COALESCE((SELECT total_games FROM game_stats WHERE user_id = ? AND game_name = ?), 0) + 1
                )
            `, [
                userId, gameName, userId, gameName, result === 'win' ? 1 : 0,
                userId, gameName, result === 'lose' ? 1 : 0,
                userId, gameName, result === 'draw' ? 1 : 0,
                userId, gameName
            ], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    getShopItems() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM shop_items ORDER BY price ASC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = new Database();